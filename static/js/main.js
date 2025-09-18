// ========================================
// 全局变量
// ========================================
let map = null;                    // Leaflet 地图实例
let markers = {};                   // 存储所有标记
let currentMode = 'view';           // 当前模式：view/heart/paw
let musicPlaying = false;           // 音乐播放状态
let currentUser = '刘等等';         // 当前用户
let allPlaces = [];                 // 所有地点数据

// API 基础 URL
const API_URL = window.location.origin;

// 自定义图标路径
const CUSTOM_ICONS = {
    heart: '/static/images/heart-icon.png',
    paw: '/static/images/paw-icon.png',
    heartFallback: '❤️',
    pawFallback: '🐾'
};

// ========================================
// 地图初始化
// ========================================
function initMap() {
    // 创建地图，默认显示波士顿
    map = L.map('map').setView([42.3601, -71.0589], 13);
    
    // 添加地图图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2  // 允许缩小看全球
    }).addTo(map);
    
    // 移除波士顿地区限制
    // 不再设置 setMaxBounds
    
    // 地图点击事件
    map.on('click', handleMapClick);
    
    // 弹窗关闭事件
    map.on('popupclose', function(e) {
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
    });
}

// ========================================
// 预设位置
// ========================================
const PRESET_LOCATIONS = {
    '波士顿': { lat: 42.3601, lng: -71.0589, zoom: 13 },
    '北京': { lat: 39.9042, lng: 116.4074, zoom: 11 },
    '上海': { lat: 31.2304, lng: 121.4737, zoom: 11 },
    '广州': { lat: 23.1291, lng: 113.2644, zoom: 11 },
    '深圳': { lat: 22.5431, lng: 114.0579, zoom: 11 },
    '成都': { lat: 30.5728, lng: 104.0668, zoom: 11 },
    '亚特兰大': { lat: 33.7490, lng: -84.3880, zoom: 11 },
    '纽约': { lat: 40.7128, lng: -74.0060, zoom: 11 },
    '洛杉矶': { lat: 34.0522, lng: -118.2437, zoom: 11 },
    '巴黎': { lat: 48.8566, lng: 2.3522, zoom: 12 },
    '伦敦': { lat: 51.5074, lng: -0.1278, zoom: 12 },
    '东京': { lat: 35.6762, lng: 139.6503, zoom: 11 }
};

// ========================================
// 跳转到指定位置
// ========================================
function jumpToLocation(locationName) {
    const location = PRESET_LOCATIONS[locationName];
    if (location) {
        map.setView([location.lat, location.lng], location.zoom);
        showNotification(`📍 已跳转到${locationName}`, 'info');
    }
}

// ========================================
// 创建自定义图标
// ========================================
function createCustomIcon(type) {
    const bgColor = type === 'heart' ? '#ffb3d9' : '#dbb3ff';  // 浅色背景
    const iconUrl = type === 'heart' ? '/static/images/heart-icon.png' : '/static/images/paw-icon.png';
    const emoji = type === 'heart' ? '❤️' : '🐾';
    
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                width: 60px; 
                height: 60px; 
                background: ${bgColor}; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                border: 4px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            ">
                <img src="${iconUrl}" 
                     style="
                         width: 45px; 
                         height: 45px; 
                         object-fit: contain;
                     " 
                     onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:32px;\\'>${emoji}</span>'">
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 60]  // 锚点在底部
    });
}
// ========================================
// 地图点击处理
// ========================================
async function handleMapClick(e) {
    if (currentMode === 'view') return;

    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // 播放点击音效
    playClickSound();
    
    // 创建临时标记
    const tempMarker = L.marker([lat, lng], {
        icon: createCustomIcon(currentMode)
    }).addTo(map);
    
    // 显示输入弹框
    const popupContent = `
        <div class="popup-content">
            <div class="popup-title">
                ${currentMode === 'heart' ? '标记想去的地方' : '标记去过的地方'}
            </div>
            <input type="text" id="placeName" class="popup-input" 
                   placeholder="给这个地方起个名字..." autofocus>
            <textarea id="placeNote" class="popup-textarea" 
                      placeholder="添加备注（可选）"></textarea>
            ${currentMode === 'paw' ? `
                <div class="rating-stars" id="ratingStars">
                    <span class="star" data-rating="1">☆</span>
                    <span class="star" data-rating="2">☆</span>
                    <span class="star" data-rating="3">☆</span>
                    <span class="star" data-rating="4">☆</span>
                    <span class="star" data-rating="5">☆</span>
                </div>
            ` : ''}
            <div class="popup-actions">
                <button class="popup-btn" onclick="saveNewPlace(${lat}, ${lng}, '${currentMode}')">
                    保存
                </button>
                <button class="popup-btn secondary" onclick="cancelNewPlace()">
                    取消
                </button>
            </div>
        </div>
    `;
    
    tempMarker.bindPopup(popupContent, {
        closeButton: false,
        closeOnClick: false
    }).openPopup();
    
    // 保存临时标记引用
    window.tempMarker = tempMarker;
    
    // 如果有评分星星，添加点击事件
    if (currentMode === 'paw') {
        setTimeout(() => {
            document.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', function() {
                    const rating = parseInt(this.dataset.rating);
                    setRating(rating);
                });
            });
        }, 100);
    }
}

// ========================================
// 保存新地点
// ========================================
async function saveNewPlace(lat, lng, type) {
    // 检查元素是否存在
    const nameElement = document.getElementById('placeName');
    const noteElement = document.getElementById('placeNote');
    
    if (!nameElement) {
        console.error('找不到placeName元素');
        showNotification('❌ 页面元素错误，请刷新重试', 'error');
        return;
    }
    
    const name = nameElement.value || '未命名地点';
    const note = noteElement ? noteElement.value : '';
    let rating = 0;
    
    // 获取评分（如果是去过的地方）
    if (type === 'paw') {
        const stars = document.querySelectorAll('.star.filled');
        rating = stars.length;
    }
    
    // 准备数据
    const placeData = {
        lat: lat,
        lng: lng,
        type: type,
        name: name,
        note: note,
        rating: rating,
        created_by: currentUser
    };
    
    try {
        // 发送到后端
        const response = await fetch(`${API_URL}/api/places`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(placeData)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 移除临时标记
            if (window.tempMarker) {
                map.removeLayer(window.tempMarker);
                window.tempMarker = null;
            }
            
            // 添加正式标记
            placeData.id = result.id;
            placeData.created_at = new Date().toISOString();
            allPlaces.push(placeData);
            addMarkerToMap(placeData);
            
            // 显示成功提示
            showNotification('✅ 地点已保存！', 'success');
            
            // 创建彩纸特效
            createConfetti();
            
            // 更新统计
            updateStats();
            updateTimeline();
            
            // 重置模式
            setMode('view');
        } else {
            // 如果是401错误，可能是未登录
            if (response.status === 401) {
                showNotification('❌ 请先登录', 'error');
                window.location.href = '/login';
            } else {
                showNotification('❌ 保存失败，请重试', 'error');
            }
        }
    } catch (error) {
        console.error('保存失败:', error);
        showNotification('❌ 网络错误，请重试', 'error');
    }
}

// ========================================
// 取消新地点
// ========================================
function cancelNewPlace() {
    // 移除临时标记
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    
    // 移除搜索产生的临时标记
    if (window.searchTempMarker) {
        map.removeLayer(window.searchTempMarker);
        window.searchTempMarker = null;
    }
    
    // 关闭所有弹窗
    map.closePopup();
    
    // 重置为查看模式
    setMode('view');
}

// ========================================
// 加载所有地点
// ========================================
async function loadPlaces() {
    try {
        showLoading(true);
        console.log('开始加载地点...');
        
        const response = await fetch(`${API_URL}/api/places`);
        console.log('加载地点响应状态:', response.status);
        
        if (response.ok) {
            const places = await response.json();
            console.log('加载到的地点:', places);
            allPlaces = places;
            
            // 清除现有标记
            console.log('清除现有标记，数量:', Object.keys(markers).length);
            Object.values(markers).forEach(marker => {
                map.removeLayer(marker);
            });
            markers = {};
            
            // 添加所有标记到地图
            console.log('准备添加标记到地图，数量:', places.length);
            places.forEach((place, index) => {
                console.log(`添加第 ${index + 1} 个标记:`, place);
                try {
                    addMarkerToMap(place);
                    console.log(`标记 ${index + 1} 添加成功`);
                } catch (err) {
                    console.error(`添加标记 ${index + 1} 失败:`, err);
                }
            });
            
            console.log('所有标记添加完成，markers对象:', markers);
            
            // 更新统计和时间轴
            updateStats();
            updateTimeline();
            
        } else {
            console.error('加载失败，状态码:', response.status);
            const errorText = await response.text();
            console.error('错误信息:', errorText);
        }
    } catch (error) {
        console.error('加载地点失败:', error);
        console.log('尝试从本地存储加载...');
        loadFromLocalStorage();
    } finally {
        showLoading(false);
        console.log('加载完成');
    }
}

// ========================================
// 从本地存储加载（备用）
// ========================================
function loadFromLocalStorage() {
    const savedPlaces = localStorage.getItem('mapPlaces');
    if (savedPlaces) {
        allPlaces = JSON.parse(savedPlaces);
        allPlaces.forEach(place => {
            addMarkerToMap(place);
        });
        updateStats();
        updateTimeline();
    }
}

// ========================================
// 添加标记到地图
// ========================================
function addMarkerToMap(place) {
    console.log('开始添加标记:', place); // 添加调试
    
    const marker = L.marker([place.lat, place.lng], {
        icon: createCustomIcon(place.type)
    }).addTo(map);
    
    console.log('标记已创建:', marker); // 添加调试
    
    const popupContent = createPopupContent(place);
    marker.bindPopup(popupContent);
    
    markers[place.id] = marker;
    console.log('标记已保存到markers:', markers); // 添加调试
}

// ========================================
// 创建弹出框内容
// ========================================
function createPopupContent(place) {
    let ratingHtml = '';
    if (place.rating > 0) {
        ratingHtml = '<div style="margin: 10px 0;">评分: ' + '⭐'.repeat(place.rating) + '</div>';
    }
    

    
    return `
        <div class="popup-content">
            <h3>${place.name}</h3>
            ${place.note ? `<p style="margin: 10px 0;">${place.note}</p>` : ''}
            ${ratingHtml}
            <div style="font-size: 12px; color: #999; margin: 10px 0;">
                标记者: ${place.created_by || '匿名'}<br>
                时间: ${new Date(place.created_at).toLocaleDateString('zh-CN')}
            </div>
            <div class="popup-actions">
                <button class="popup-btn" onclick="editPlace(${place.id})">编辑</button>
                <button class="popup-btn" onclick="viewMessages(${place.id})">💬 留言</button>
                <button class="popup-btn" onclick="navigateToPlace(${place.lat}, ${place.lng})">🧭 导航</button>
                <button class="popup-btn secondary" onclick="deletePlace(${place.id})">删除</button>
            </div>
        </div>
    `;
}

// ========================================
// 显示地点列表
// ========================================
function showPlacesList(type) {
    const modal = document.getElementById('placesListModal');
    const modalTitle = document.getElementById('modalTitle');
    const placesList = document.getElementById('placesList');
    
    // 设置标题
    modalTitle.textContent = type === 'heart' ? '❤️ 想去的地方' : '🐾 去过的地方';
    
    // 筛选地点
    const filteredPlaces = allPlaces.filter(p => p.type === type);
    
    if (filteredPlaces.length === 0) {
        placesList.innerHTML = `
            <div style="text-align: center; color: #999; padding: 40px;">
                暂无${type === 'heart' ? '想去' : '去过'}的地方
            </div>
        `;
    } else {
        placesList.innerHTML = filteredPlaces.map(place => `
            <div class="place-item" onclick="focusOnPlace(${place.id})">
                <div class="place-item-header">
                    <h4>${place.name}</h4>
                    ${place.rating ? '<div class="place-rating">' + '⭐'.repeat(place.rating) + '</div>' : ''}
                </div>
                ${place.note ? `<p class="place-note">${place.note}</p>` : ''}
                <div class="place-meta">
                    <span>📍 ${new Date(place.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>👤 ${place.created_by}</span>
                </div>
                <div class="place-actions">
                    <button onclick="event.stopPropagation(); focusOnPlace(${place.id})" class="mini-btn">查看</button>
                    <button onclick="event.stopPropagation(); editPlace(${place.id})" class="mini-btn">编辑</button>
                    <button onclick="event.stopPropagation(); deletePlace(${place.id})" class="mini-btn danger">删除</button>
                </div>
            </div>
        `).join('');
    }
    
    // 显示模态框
    modal.style.display = 'block';
}

// ========================================
// 关闭地点列表
// ========================================
function closePlacesList() {
    const modal = document.getElementById('placesListModal');
    modal.style.display = 'none';
}

// ========================================
// 聚焦到某个地点
// ========================================
function focusOnPlace(placeId) {
    const place = allPlaces.find(p => p.id === placeId);
    if (place && markers[placeId]) {
        // 关闭列表
        closePlacesList();
        
        // 移动地图到该位置
        map.setView([place.lat, place.lng], 16);
        
        // 打开弹窗
        markers[placeId].openPopup();
        
        // 添加动画效果
        const markerElement = markers[placeId]._icon;
        if (markerElement) {
            markerElement.style.animation = 'bounce 0.5s';
            setTimeout(() => {
                markerElement.style.animation = '';
            }, 500);
        }
    }
}

// ========================================
// 导航到地点
// ========================================
function navigateToPlace(lat, lng) {
    // 使用 Google Maps 导航
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
}

// ========================================
// 编辑地点
// ========================================
async function editPlace(placeId) {
    const place = allPlaces.find(p => p.id === placeId);
    if (!place) return;
    
    const newName = prompt('修改地点名称:', place.name);
    if (newName && newName !== place.name) {
        try {
            const response = await fetch(`${API_URL}/api/places/${placeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                place.name = newName;
                showNotification('✅ 已更新', 'success');
                loadPlaces();
            }
        } catch (error) {
            console.error('更新失败:', error);
            place.name = newName;
            saveToLocalStorage();
            loadPlaces();
        }
    }
}

// ========================================
// 删除地点
// ========================================
async function deletePlace(placeId) {
    if (!confirm('确定要删除这个地点吗？')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/places/${placeId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            removeMarkerAndPlace(placeId);
        }
    } catch (error) {
        console.error('删除失败:', error);
        // 本地删除
        removeMarkerAndPlace(placeId);
    }
}

// ========================================
// 移除标记和地点
// ========================================
function removeMarkerAndPlace(placeId) {
    // 从地图移除标记
    if (markers[placeId]) {
        map.removeLayer(markers[placeId]);
        delete markers[placeId];
    }
    
    // 从数组中移除
    allPlaces = allPlaces.filter(p => p.id !== placeId);
    
    // 更新本地存储
    saveToLocalStorage();
    
    showNotification('✅ 已删除', 'success');
    updateStats();
    updateTimeline();
    
    // 如果在列表视图中，刷新列表
    if (document.getElementById('placesListModal').style.display === 'block') {
        const currentType = document.getElementById('modalTitle').textContent.includes('想去') ? 'heart' : 'paw';
        showPlacesList(currentType);
    }
}

// ========================================
// 保存到本地存储
// ========================================
function saveToLocalStorage() {
    localStorage.setItem('mapPlaces', JSON.stringify(allPlaces));
}



// ========================================
// 查看和管理留言
// ========================================
async function viewMessages(placeId) {
    const place = allPlaces.find(p => p.id === placeId);
    if (!place) return;
    
    try {
        // 获取留言
        const response = await fetch(`${API_URL}/api/places/${placeId}/messages`);
        const messages = await response.json();
        
        // 创建留言弹窗
        const messagesModal = document.createElement('div');
        messagesModal.className = 'modal';
        messagesModal.style.display = 'block';
        messagesModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>📝 ${place.name} - 留言板</h2>
                    <span class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <!-- 添加留言区 -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <textarea id="newMessage" placeholder="写下你的留言..." 
                                style="width: 100%; min-height: 60px; padding: 10px; border: 2px solid #f093fb; border-radius: 8px; resize: vertical;"></textarea>
                        <button onclick="addMessage(${placeId})" 
                                style="margin-top: 10px; padding: 10px 20px; background: linear-gradient(45deg, #f093fb, #f5576c); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            发送留言
                        </button>
                    </div>
                    
                    <!-- 留言列表 -->
                    <div id="messagesList">
                        ${messages.length === 0 ? 
                            '<div style="text-align: center; color: #999; padding: 40px;">还没有留言，来写第一条吧！</div>' :
                            messages.map(msg => createMessageHTML(msg)).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(messagesModal);
        
        // 点击背景关闭
        messagesModal.onclick = function(e) {
            if (e.target === messagesModal) {
                messagesModal.remove();
            }
        };
        
        // 保存到全局以便其他函数访问
        window.currentMessagesModal = messagesModal;
        window.currentPlaceId = placeId;
        
    } catch (error) {
        console.error('获取留言失败:', error);
        showNotification('获取留言失败', 'error');
    }
}

// 创建留言HTML
function createMessageHTML(message) {
    const date = new Date(message.created_at).toLocaleString('zh-CN');
    return `
        <div class="message-item" data-message-id="${message.id}" style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: bold; color: #764ba2;">${message.author}</span>
                <span style="font-size: 12px; color: #999;">${date}</span>
            </div>
            <div style="color: #333; line-height: 1.5;">${message.content}</div>
            <button onclick="deleteMessage(${message.id})" 
                    style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">
                删除
            </button>
        </div>
    `;
}

// 添加留言
async function addMessage(placeId) {
    const textarea = document.getElementById('newMessage');
    const content = textarea.value.trim();
    
    if (!content) {
        showNotification('请输入留言内容', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/places/${placeId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 清空输入框
            textarea.value = '';
            
            // 添加新留言到列表
            const messagesList = document.getElementById('messagesList');
            const newMessageHTML = createMessageHTML({
                id: result.id,
                author: result.author,
                content: content,
                created_at: result.created_at
            });
            
            // 如果是第一条留言，替换提示文字
            if (messagesList.innerHTML.includes('还没有留言')) {
                messagesList.innerHTML = newMessageHTML;
            } else {
                messagesList.insertAdjacentHTML('afterbegin', newMessageHTML);
            }
            
            showNotification('✅ 留言已发送', 'success');
            
        } else {
            const error = await response.json();
            showNotification(error.error || '发送失败', 'error');
        }
    } catch (error) {
        console.error('发送留言失败:', error);
        showNotification('发送失败，请重试', 'error');
    }
}

// 删除留言
async function deleteMessage(messageId) {
    if (!confirm('确定要删除这条留言吗？')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // 从DOM中移除留言
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            
            // 检查是否还有留言
            const messagesList = document.getElementById('messagesList');
            if (messagesList && messagesList.children.length === 0) {
                messagesList.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">还没有留言，来写第一条吧！</div>';
            }
            
            showNotification('✅ 留言已删除', 'success');
        }
    } catch (error) {
        console.error('删除留言失败:', error);
        showNotification('删除失败', 'error');
    }
}

// ========================================
// 设置模式
// ========================================
function setMode(mode) {
    currentMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`mode-${mode}`).classList.add('active');
    
    // 显示提示
    if (mode !== 'view') {
        const tips = {
            'heart': '点击地图标记想去的地方！',
            'paw': '点击地图标记我们去过的地方🐾'
        };
        showNotification(tips[mode], 'info');
    }
}

// ========================================
// 设置评分
// ========================================
function setRating(rating) {
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.classList.add('filled');
        } else {
            star.textContent = '☆';
            star.classList.remove('filled');
        }
    });
}

// ========================================
// 更新统计
// ========================================
async function updateStats() {
    // 计算统计数据
    const heartCount = allPlaces.filter(p => p.type === 'heart').length;
    const pawCount = allPlaces.filter(p => p.type === 'paw').length;
    const total = heartCount + pawCount;
    const completionRate = total > 0 ? Math.round((pawCount / total) * 100) : 0;
    
    // 更新显示
    document.getElementById('heartCount').textContent = heartCount;
    document.getElementById('pawCount').textContent = pawCount;
    document.getElementById('userHeartCount').textContent = heartCount;
    document.getElementById('userPawCount').textContent = pawCount;
    document.getElementById('completionRate').textContent = completionRate;
    document.getElementById('progressBar').style.width = `${completionRate}%`;
    
    // 尝试从后端获取更详细的统计
    try {
        const response = await fetch(`${API_URL}/api/stats`);
        if (response.ok) {
            const stats = await response.json();
            // 使用后端数据更新
            if (stats.recent_activities) {
                updateTimelineWithData(stats.recent_activities);
            }
        }
    } catch (error) {
        // 使用本地数据
    }
}

// ========================================
// 更新时间轴
// ========================================
function updateTimeline() {
    const timelineContent = document.getElementById('timelineContent');
    
    // 获取最近的5个地点
    const recentPlaces = [...allPlaces]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);
    
    if (recentPlaces.length === 0) {
        timelineContent.innerHTML = '<div style="color: #999; font-size: 12px;">暂无标记</div>';
        return;
    }
    
    timelineContent.innerHTML = recentPlaces.map(place => {
        const icon = place.type === 'heart' ? '❤️' : '🐾';
        const date = new Date(place.created_at || Date.now()).toLocaleDateString('zh-CN');
        return `
            <div class="timeline-item" onclick="focusOnPlace(${place.id})" style="cursor: pointer;">
                ${icon} ${place.name} 
                <div style="font-size: 10px; color: #999;">${date}</div>
            </div>
        `;
    }).join('');
}

// ========================================
// 更新时间轴（使用统计数据）
// ========================================
function updateTimelineWithData(activities) {
    const timelineContent = document.getElementById('timelineContent');
    
    if (!activities || activities.length === 0) {
        timelineContent.innerHTML = '<div style="color: #999; font-size: 12px;">暂无标记</div>';
        return;
    }
    
    timelineContent.innerHTML = activities.map(activity => {
        const icon = activity.type === 'heart' ? '❤️' : '🐾';
        const date = new Date(activity.created_at).toLocaleDateString('zh-CN');
        return `
            <div class="timeline-item">
                ${icon} ${activity.name || '未命名'} 
                <div style="font-size: 10px; color: #999;">${date}</div>
            </div>
        `;
    }).join('');
}

// ========================================
// 播放点击音效
// ========================================
function playClickSound() {
    const sound = document.getElementById('clickSound');
    if (sound) {
        sound.volume = 0.5; // 调整音量
        sound.currentTime = 0; // 重置到开始
        sound.play().catch(e => {
            console.log('音效播放失败:', e);
        });
    }
}

// ========================================
// 音乐控制
// ========================================
function toggleMusic() {
    const music = document.getElementById('bgMusic');
    const btn = document.getElementById('musicBtn');
    const icon = document.getElementById('musicIcon');
    
    if (!music) return;
    
    if (!musicPlaying) {
        music.volume = 0.3;
        music.play().then(() => {
            // 切换图标
            if (icon) {
                icon.src = '/static/images/music-on.png';
            } else {
                btn.textContent = '🔇';
            }
            musicPlaying = true;
            showNotification('🎵 音乐已开启', 'info');
        }).catch(e => {
            showNotification('⚠️ 无法播放音乐', 'error');
        });
    } else {
        music.pause();
        // 切换图标
        if (icon) {
            icon.src = '/static/images/music-off.png';
        } else {
            btn.textContent = '🎵';
        }
        musicPlaying = false;
        showNotification('🔇 音乐已关闭', 'info');
    }
}

// ========================================
// 显示通知
// ========================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// ========================================
// 显示/隐藏加载提示
// ========================================
function showLoading(show) {
    const loading = document.getElementById('loadingTip');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

// ========================================
// 创建彩纸特效
// ========================================
function createConfetti() {
    // 从中心爆炸式撒花
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        const velocity = 200 + Math.random() * 200;
        
        const confetti = document.createElement('img');
        confetti.src = '/static/images/star.png';
        confetti.style.cssText = `
            position: fixed;
            width: 50px;
            height: 50px;
            left: ${centerX}px;
            top: ${centerY}px;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(confetti);
        
        // 使用 JavaScript 动画实现爆炸效果
        let x = 0;
        let y = 0;
        let rotation = 0;
        let opacity = 1;
        let gravity = 0;
        
        const animate = () => {
            x += Math.cos(angle) * velocity * 0.02;
            y += Math.sin(angle) * velocity * 0.02 + gravity;
            gravity += 0.5;
            rotation += 10;
            opacity -= 0.01;
            
            confetti.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            confetti.style.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                confetti.remove();
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// 添加成功提示动画
function showSuccessMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #f093fb, #f5576c);
        color: white;
        padding: 20px 40px;
        border-radius: 20px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        animation: successPop 0.5s ease;
        box-shadow: 0 10px 40px rgba(240, 147, 251, 0.4);
    `;
    message.innerHTML = '✨ 标记成功！';
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.animation = 'fadeOut 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 2000);
}

async function searchAddress() {
    const address = document.getElementById('addressSearch').value.trim();
    if (!address) {
        showNotification('请输入地址', 'error');
        return;
    }
    
    // 判断是否是中文地址
    const isChinese = /[\u4e00-\u9fa5]/.test(address);
    let fullAddress = address;
    
    // 如果是英文地址且不包含城市信息，添加 Boston
    if (!isChinese && !address.includes(',')) {
        fullAddress = address.includes('Boston') ? address : `${address}, Boston, MA`;
    }
    
    try {
        showLoading(true);
        
        // 使用 Nominatim API，添加中文支持参数
        const url = `https://nominatim.openstreetmap.org/search?` + 
            `format=json&` +
            `q=${encodeURIComponent(fullAddress)}&` +
            `limit=5&` +
            `accept-language=zh-CN,zh,en&` +  // 支持中文
            `countrycodes=cn,us`;  // 优先搜索中国和美国
        
        const response = await fetch(url);
        const results = await response.json();
        
        if (results && results.length > 0) {
            // 如果只有一个结果，直接定位
            if (results.length === 1) {
                const result = results[0];
                locateToAddress(result.lat, result.lon, result.display_name);
            } else {
                // 显示搜索建议
                showSearchSuggestions(results);
            }
        } else {
            // 如果没找到，尝试更模糊的搜索
            if (isChinese) {
                // 对中文地址尝试添加"中国"前缀
                const retryUrl = `https://nominatim.openstreetmap.org/search?` + 
                    `format=json&` +
                    `q=${encodeURIComponent('中国 ' + fullAddress)}&` +
                    `limit=5&` +
                    `accept-language=zh-CN,zh,en`;
                
                const retryResponse = await fetch(retryUrl);
                const retryResults = await retryResponse.json();
                
                if (retryResults && retryResults.length > 0) {
                    showSearchSuggestions(retryResults);
                } else {
                    showNotification('未找到该地址，请尝试更详细的地址（如：广州市天河区天河城）', 'error');
                }
            } else {
                showNotification('未找到该地址，请尝试更详细的地址', 'error');
            }
        }
    } catch (error) {
        console.error('搜索失败:', error);
        showNotification('搜索失败，请重试', 'error');
    } finally {
        showLoading(false);
    }
}

// 显示搜索建议
function showSearchSuggestions(results) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.style.display = 'block';
    
    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; transition: background 0.3s;';
        
        // 处理显示名称，让中文地址更易读
        let displayName = result.display_name;
        // 如果是中文地址，简化显示
        if (/[\u4e00-\u9fa5]/.test(displayName)) {
            // 移除重复的国家信息
            displayName = displayName.replace(/,\s*中国$/, '');
            displayName = displayName.replace(/,\s*China$/, '');
        }
        
        item.innerHTML = `
            <div style="font-size: 14px; color: #333;">${displayName}</div>
            <div style="font-size: 12px; color: #999; margin-top: 2px;">
                ${result.type ? result.type.replace(/_/g, ' ') : ''}
            </div>
        `;
        
        item.onmouseover = () => item.style.background = '#f5f5f5';
        item.onmouseout = () => item.style.background = 'white';
        item.onclick = () => {
            locateToAddress(result.lat, result.lon, displayName);
            suggestionsDiv.style.display = 'none';
            document.getElementById('addressSearch').value = '';
        };
        suggestionsDiv.appendChild(item);
    });
}

// 定位到地址并显示标记选项
function locateToAddress(lat, lng, displayName) {
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    
    // 移动地图到该位置
    map.setView([lat, lng], 16);
    
    // 创建临时标记
    const tempMarker = L.marker([lat, lng]).addTo(map);
    
    // 显示弹窗让用户选择操作
    const popupContent = `
        <div style="text-align: center; padding: 10px;">
            <h4 style="color: #764ba2; margin-bottom: 10px;">找到位置！</h4>
            <p style="font-size: 12px; color: #666; margin-bottom: 15px;">${displayName}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="markAsWantToGo(${lat}, ${lng}, '${displayName.replace(/'/g, "\\'")}')" 
                        style="padding: 8px 15px; background: #ff69b4; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    ❤️ 想去
                </button>
                <button onclick="markAsVisited(${lat}, ${lng}, '${displayName.replace(/'/g, "\\'")}')" 
                        style="padding: 8px 15px; background: #9370db; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    🐾 去过
                </button>
                <button onclick="cancelSearchMarker()" 
                        style="padding: 8px 15px; background: #999; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    取消
                </button>
            </div>
        </div>
    `;
    
    tempMarker.bindPopup(popupContent, {
        closeButton: false,
        autoClose: false,
        closeOnClick: false
    }).openPopup();
    
    // 保存临时标记引用
    window.searchTempMarker = tempMarker;
}

// 标记为想去
function markAsWantToGo(lat, lng, address) {
    if (window.searchTempMarker) {
        map.removeLayer(window.searchTempMarker);
    }
    
    setMode('heart');
    
    const tempMarker = L.marker([lat, lng], {
        icon: createCustomIcon('heart')
    }).addTo(map);
    
    // 处理地址中的特殊字符
    const safeName = address.split(',')[0].replace(/'/g, '').replace(/"/g, '');
    
    const popupContent = `
        <div class="popup-content">
            <div class="popup-title">标记想去的地方</div>
            <input type="text" id="placeName" class="popup-input" 
                   value="${safeName}" placeholder="给这个地方起个名字...">
            <textarea id="placeNote" class="popup-textarea" 
                      placeholder="添加备注（可选）"></textarea>
            <div class="popup-actions">
                <button class="popup-btn" onclick="saveNewPlace(${lat}, ${lng}, 'heart')">保存</button>
                <button class="popup-btn secondary" onclick="cancelNewPlace()">取消</button>
            </div>
        </div>
    `;
    
    tempMarker.bindPopup(popupContent, {
        closeButton: false,
        closeOnClick: false
    }).openPopup();
    
    window.tempMarker = tempMarker;
}

// 标记为去过
function markAsVisited(lat, lng, address) {
    // 移除搜索标记
    if (window.searchTempMarker) {
        map.removeLayer(window.searchTempMarker);
    }
    
    // 切换到去过模式
    setMode('paw');
    
    // 创建标记
    const tempMarker = L.marker([lat, lng], {
        icon: createCustomIcon('paw')
    }).addTo(map);
    
    // 显示保存弹窗
    const popupContent = `
        <div class="popup-content">
            <div class="popup-title">标记去过的地方</div>
            <input type="text" id="placeName" class="popup-input" 
                   value="${address.split(',')[0]}" placeholder="给这个地方起个名字...">
            <textarea id="placeNote" class="popup-textarea" 
                      placeholder="添加备注（可选）"></textarea>
            <div class="rating-stars" id="ratingStars">
                <span class="star" data-rating="1">☆</span>
                <span class="star" data-rating="2">☆</span>
                <span class="star" data-rating="3">☆</span>
                <span class="star" data-rating="4">☆</span>
                <span class="star" data-rating="5">☆</span>
            </div>
            <div class="popup-actions">
                <button class="popup-btn" onclick="saveNewPlace(${lat}, ${lng}, 'paw')">保存</button>
                <button class="popup-btn secondary" onclick="cancelNewPlace()">取消</button>
            </div>
        </div>
    `;
    
    tempMarker.bindPopup(popupContent, {
        closeButton: false,
        closeOnClick: false
    }).openPopup();
    
    window.tempMarker = tempMarker;
    
    // 添加评分功能
    setTimeout(() => {
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                setRating(rating);
            });
        });
    }, 100);
}

// 取消搜索标记
function cancelSearchMarker() {
    if (window.searchTempMarker) {
        map.removeLayer(window.searchTempMarker);
        window.searchTempMarker = null;
    }
}

// 点击地图其他地方时隐藏搜索建议
document.addEventListener('click', function(e) {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer.contains(e.target)) {
        document.getElementById('searchSuggestions').style.display = 'none';
    }
});

// 添加自动完成功能（可选）
document.getElementById('addressSearch').addEventListener('input', function() {
    const value = this.value;
    if (value.length > 3) {
        // 可以在这里添加实时搜索建议
        // 为了避免过多请求，可以加个延迟
    }
});

// 导出备份
async function exportBackup() {
    try {
        const response = await fetch('/api/export');
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `love-map-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            // 创建带图标的通知
            const notification = document.createElement('div');
            notification.className = 'notification success';
            notification.innerHTML = `
                <img src="/static/images/export-success-icon.png" 
                     style="width: 20px; height: 20px; vertical-align: middle; margin-right: 5px;"
                     onerror="this.style.display='none'">
                <span>备份已下载</span>
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s ease';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }
    } catch (error) {
        showNotification('备份失败', 'error');
    }
}

// 显示导入对话框
function showImportDialog() {
    if (confirm('导入备份会添加新的地点到现有数据中，是否继续？')) {
        document.getElementById('importFile').click();
    }
}

// 导入备份
async function importBackup(input) {
    const file = input.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('backup_file', file);
    
    try {
        showLoading(true);
        const response = await fetch('/api/import', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`✅ 成功导入 ${result.imported}/${result.total} 个地点`, 'success');
            // 重新加载地图
            loadPlaces();
        } else {
            showNotification('导入失败', 'error');
        }
    } catch (error) {
        showNotification('导入出错', 'error');
    } finally {
        showLoading(false);
        input.value = ''; // 清空选择
    }
}

// ========================================
// 导出功能：全局函数供 HTML 调用
// ========================================
window.setMode = setMode;
window.toggleMusic = toggleMusic;
window.saveNewPlace = saveNewPlace;
window.cancelNewPlace = cancelNewPlace;
window.editPlace = editPlace;
window.deletePlace = deletePlace;
window.viewMessages = viewMessages;
window.showNotification = showNotification;
window.showPlacesList = showPlacesList;
window.closePlacesList = closePlacesList;
window.focusOnPlace = focusOnPlace;
window.navigateToPlace = navigateToPlace;
window.searchAddress = searchAddress;
window.markAsWantToGo = markAsWantToGo;
window.markAsVisited = markAsVisited;
window.cancelSearchMarker = cancelSearchMarker;
window.exportBackup = exportBackup;
window.showImportDialog = showImportDialog;
window.importBackup = importBackup;
window.jumpToLocation = jumpToLocation;
window.addMessage = addMessage;
window.deleteMessage = deleteMessage;
window.createMessageHTML = createMessageHTML;