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

// 地理范围定义
const GEOGRAPHIC_RANGES = {
    global: { name: '🌍 全球范围', bounds: null },
    asia: { 
        name: '🌏 亚洲', 
        bounds: { minLat: -10, maxLat: 55, minLng: 60, maxLng: 150 }
    },
    northAmerica: { 
        name: '🌎 北美', 
        bounds: { minLat: 15, maxLat: 72, minLng: -168, maxLng: -52 }
    },
    usa: { 
        name: '🇺🇸 美国', 
        bounds: { minLat: 24, maxLat: 49, minLng: -125, maxLng: -66 }
    },
    china: { 
        name: '🇨🇳 中国', 
        bounds: { minLat: 18, maxLat: 54, minLng: 73, maxLng: 135 }
    },
    boston: { 
        name: '📍 波士顿地区', 
        bounds: { minLat: 42.2, maxLat: 42.5, minLng: -71.2, maxLng: -70.9 }
    },
    currentCity: {
        name: '📍 当前城市范围',
        bounds: null // 动态计算
    }
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

// 餐厅类型配置
const RESTAURANT_TYPES = {
    chinese: { name: '中餐', icon: 'chinese-food-icon.png', color: '#ff6b6b' },
    western: { name: '西餐', icon: 'western-food-icon.png', color: '#4ecdc4' },
    japanese: { name: '日料', icon: 'japanese-food-icon.png', color: '#ff8787' },
    korean: { name: '韩餐', icon: 'korean-food-icon.png', color: '#feca57' },
    cafe: { name: '咖啡店', icon: 'cafe-icon.png', color: '#8b6f47' },
    dessert: { name: '甜品', icon: 'dessert-icon.png', color: '#ff9ff3' },
    hotpot: { name: '火锅', icon: 'hotpot-icon.png', color: '#ee5a6f' },
    bbq: { name: '烧烤', icon: 'bbq-icon.png', color: '#ff6348' },
    tea: { name: '茶饮', icon: 'tea-icon.png', color: '#7bed9f' },
    bar: { name: '酒吧', icon: 'bar-icon.png', color: '#5f27cd' },
    fastfood: { name: '快餐', icon: 'fastfood-icon.png', color: '#ffa502' },
    other: { name: '其他', icon: 'other-food-icon.png', color: '#a29bfe' }
};

// 创建分类图标
function createCategoryIcon(type, category) {
    const config = RESTAURANT_TYPES[category] || RESTAURANT_TYPES.other;
    const iconUrl = `/static/images/food-icons/${config.icon}`;
    const bgColor = type === 'heart' ? '#ffb3d9' : config.color;
    
    return L.divIcon({
        className: 'custom-marker category-marker',
        html: `
            <div style="
                position: relative;
                width: 50px; 
                height: 60px;
            ">
                <!-- 底部圆形背景 -->
                <div style="
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 40px; 
                    height: 40px; 
                    background: ${bgColor}; 
                    border-radius: 50% 50% 50% 0;
                    transform: translateX(-50%) rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                "></div>
                
                <!-- 图标 -->
                <img src="${iconUrl}" 
                     style="
                         position: absolute;
                         top: 5px;
                         left: 50%;
                         transform: translateX(-50%);
                         width: 28px; 
                         height: 28px;
                         z-index: 1;
                     " 
                     onerror="this.src='/static/images/food-icons/other-food-icon.png'">
                
                <!-- 如果是想去的地方，添加小心心 -->
                ${type === 'heart' ? `
                    <img src="/static/images/mini-heart.png" 
                         style="
                             position: absolute;
                             top: 0;
                             right: 0;
                             width: 16px;
                             height: 16px;
                             z-index: 2;
                         "
                         onerror="this.style.display='none'">
                ` : ''}
            </div>
        `,
        iconSize: [50, 60],
        iconAnchor: [25, 60]
    });
}

// ========================================
// 筛选标记
// ========================================
function filterMarkers(category) {
    console.log('筛选类别:', category);
    
    // 遍历所有标记
    Object.keys(markers).forEach(placeId => {
        const place = allPlaces.find(p => p.id === parseInt(placeId));
        const marker = markers[placeId];
        
        if (!place || !marker) return;
        
        // 如果选择显示全部，或者地点类别匹配
        if (category === 'all' || place.category === category) {
            // 显示标记
            if (!map.hasLayer(marker)) {
                marker.addTo(map);
            }
        } else {
            // 隐藏标记
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });
    
    // 更新统计
    updateFilteredStats(category);
}

// 更新筛选后的统计
function updateFilteredStats(category) {
    let visibleHeartCount = 0;
    let visiblePawCount = 0;
    
    allPlaces.forEach(place => {
        if (category === 'all' || place.category === category) {
            if (place.type === 'heart') {
                visibleHeartCount++;
            } else if (place.type === 'paw') {
                visiblePawCount++;
            }
        }
    });
    
    // 显示筛选结果提示
    const filterText = category === 'all' ? '全部' : (RESTAURANT_TYPES[category]?.name || '其他');
    showNotification(`正在显示: ${filterText} (${visibleHeartCount + visiblePawCount}个地点)`, 'info');
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
            
            <!-- 餐厅类型选择 -->
            <div style="margin: 10px 0;">
                <label style="font-size: 12px; color: #666;">选择类型：</label>
                <select id="placeCategory" class="popup-input" style="width: 100%; padding: 8px;">
                    ${Object.entries(RESTAURANT_TYPES).map(([key, value]) => 
                        `<option value="${key}">${value.name}</option>`
                    ).join('')}
                </select>
            </div>
            
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
    const nameElement = document.getElementById('placeName');
    const noteElement = document.getElementById('placeNote');
    const categoryElement = document.getElementById('placeCategory'); // 新增
    
    if (!nameElement) {
        console.error('找不到placeName元素');
        showNotification('⌒ 页面元素错误，请刷新重试', 'error');
        return;
    }
    
    const name = nameElement.value || '未命名地点';
    const note = noteElement ? noteElement.value : '';
    const category = categoryElement ? categoryElement.value : 'other'; // 新增
    let rating = 0;
    
    if (type === 'paw') {
        const stars = document.querySelectorAll('.star.filled');
        rating = stars.length;
    }
    
    const placeData = {
        lat: lat,
        lng: lng,
        type: type,
        name: name,
        note: note,
        rating: rating,
        category: category, // 新增
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
                ${place.type === 'heart' ? `
                    <button class="popup-btn" onclick="convertToVisited(${place.id})" 
                            style="background: linear-gradient(45deg, #00d2ff, #3a7bd5);">
                        ✓ 已去过
                    </button>
                ` : ''}
                <button class="popup-btn" onclick="editPlace(${place.id})">编辑</button>
                <button class="popup-btn" onclick="viewMessages(${place.id})">💬 留言</button>
                <button class="popup-btn" onclick="navigateToPlace(${place.lat}, ${place.lng})">🧭 导航</button>
                <button class="popup-btn secondary" onclick="deletePlace(${place.id})">删除</button>
            </div>
        </div>
    `;
}

// ========================================
// 将想去的地方转换为去过
// ========================================
async function convertToVisited(placeId) {
    const place = allPlaces.find(p => p.id === placeId);
    if (!place || place.type !== 'heart') return;
    
    // 创建评分弹窗
    const ratingModal = document.createElement('div');
    ratingModal.className = 'modal';
    ratingModal.style.display = 'block';
    ratingModal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <img src="/static/images/congrats-icon.png" 
                         style="width: 50px; height: 50px;" 
                         onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '🎉 ')">
                    打卡成功啦！
                </h2>
                <span class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
            </div>
            <div class="modal-body" style="text-align: center;">
                <h3 style="color: #764ba2; margin-bottom: 20px;">${place.name}</h3>
                <p style="margin-bottom: 20px;">来打个分吧！：</p>
                <div class="rating-stars" id="convertRatingStars" style="font-size: 32px; margin-bottom: 20px;">
                    <span class="star" data-rating="1" onclick="setConvertRating(1)">☆</span>
                    <span class="star" data-rating="2" onclick="setConvertRating(2)">☆</span>
                    <span class="star" data-rating="3" onclick="setConvertRating(3)">☆</span>
                    <span class="star" data-rating="4" onclick="setConvertRating(4)">☆</span>
                    <span class="star" data-rating="5" onclick="setConvertRating(5)">☆</span>
                </div>
                <textarea id="visitNote" placeholder="添加体验感受（可选）" 
                          style="width: 100%; min-height: 80px; padding: 10px; 
                                 border: 2px solid #f093fb; border-radius: 8px; 
                                 margin-bottom: 20px;"></textarea>
                <button onclick="confirmConvert(${placeId})" 
                        style="padding: 12px 30px; background: linear-gradient(45deg, #f093fb, #f5576c); 
                               color: white; border: none; border-radius: 10px; cursor: pointer; 
                               font-size: 16px;">
                    确认打卡
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(ratingModal);
    window.currentConvertRating = 0;
    window.currentConvertModal = ratingModal;
}

// 设置转换时的评分
function setConvertRating(rating) {
    window.currentConvertRating = rating;
    const stars = document.querySelectorAll('#convertRatingStars .star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.style.color = '#ffd700';
        } else {
            star.textContent = '☆';
            star.style.color = '#ddd';
        }
    });
}

// 确认转换
async function confirmConvert(placeId) {
    const place = allPlaces.find(p => p.id === placeId);
    if (!place) return;
    
    const visitNote = document.getElementById('visitNote').value;
    const rating = window.currentConvertRating || 0;
    
    try {
        // 只更新必要字段，保留原有信息
        const updateData = {
            type: 'paw',
            rating: rating,
            visited_at: new Date().toISOString()
        };
        
        if (visitNote) {
            updateData.note = place.note ? 
                `${place.note}\n打卡感受: ${visitNote}` : 
                `打卡感受: ${visitNote}`;
        }
        
        const response = await fetch(`${API_URL}/api/places/${placeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            // 关闭弹窗
            if (window.currentConvertModal) {
                window.currentConvertModal.remove();
            }
            map.closePopup();
            
            // 先移除旧的标记
            if (markers[placeId]) {
                map.removeLayer(markers[placeId]);
                delete markers[placeId];
            }
            
            // 更新本地数据
            place.type = 'paw';
            place.rating = rating;
            place.visited_at = new Date().toISOString();
            if (visitNote) {
                place.note = updateData.note;
            }
            
            // 创建新的去过标记（脚印图标）
            const newMarker = L.marker([place.lat, place.lng], {
                icon: createCustomIcon('paw')  // 使用脚印图标
            }).addTo(map);
            
            const popupContent = createPopupContent(place);
            newMarker.bindPopup(popupContent);
            markers[placeId] = newMarker;
            
            // 更新统计
            updateStats();
            updateTimeline();
            
            // 显示成就
            showAchievement('哟西！', `成功打卡 ${place.name}`, '/static/images/celebration-icon.png');
            createConfetti();
            playClickSound();
            showNotification('✅ 恭喜完成打卡！', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || '转换失败', 'error');
        }
    } catch (error) {
        console.error('转换失败:', error);
        showNotification('转换失败，请重试', 'error');
    }
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
    
    // 正确的完成率计算：
    // 方案1：如果想去的地方为0，完成率为100%（没有待完成的）
    // 方案2：计算"去过"占"想去"的百分比（需要追踪哪些想去的地方已经去过）
    
    let completionRate = 0;
    if (heartCount === 0 && pawCount > 0) {
        // 没有想去的地方，都去过了
        completionRate = 100;
    } else if (heartCount === 0 && pawCount === 0) {
        // 还没开始标记
        completionRate = 0;
    } else if (heartCount > 0) {
        // 这里简化处理：假设去过的地方越多，越接近完成
        // 理想情况是追踪具体哪些"想去"的地方变成了"去过"
        completionRate = Math.min(Math.round((pawCount / heartCount) * 100), 100);
    }
    
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
// 扭蛋机功能
// ========================================
let isSpinning = false;

function openGachapon() {
    // 获取想去的地方
    const heartPlaces = allPlaces.filter(p => p.type === 'heart');
    
    // 获取所有分类
    const categories = [...new Set(heartPlaces.map(p => p.category || 'other'))];
    
    // 获取当前地图中心，用于"当前城市"选项
    const mapCenter = map.getCenter();
    const currentBounds = {
        minLat: mapCenter.lat - 0.15,
        maxLat: mapCenter.lat + 0.15,
        minLng: mapCenter.lng - 0.15,
        maxLng: mapCenter.lng + 0.15
    };
    GEOGRAPHIC_RANGES.currentCity.bounds = currentBounds;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="
            max-width: 420px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(240, 147, 251, 0.3);
            box-shadow: 0 20px 60px rgba(118, 75, 162, 0.3);
        ">
            <div class="modal-header" style="
                background: linear-gradient(45deg, rgba(240, 147, 251, 0.8), rgba(245, 87, 108, 0.8));
                border-bottom: none;
                padding: 15px 20px;
            ">
                <h2 style="color: white; text-align: center; width: 100%; font-size: 20px;">
                    🐾 修勾扭蛋机 🐾
                </h2>
                <span class="modal-close" style="color: white;" 
                      onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
            </div>
            <div class="modal-body" style="
                text-align: center; 
                padding: 15px;
                background: transparent;
            ">
                <!-- 扭蛋机主体 -->
                <div id="gachaponMachine" style="position: relative; margin: 0 auto;">
                    <img id="machineImage" src="/static/images/gachapon-idle.png" 
                         style="width: 230px; height: 288px;"
                         onerror="this.style.display='none'">
                    
                    <!-- 扭蛋结果显示区 -->
                    <div id="capsuleResult" style="display: none; 
                                                   position: absolute; 
                                                   bottom: -25px; 
                                                   left: 50%; 
                                                   transform: translateX(-50%);">
                        <img src="/static/images/capsule-gold.png" 
                             style="width: 60px; height: 60px; 
                                    animation: bounceIn 0.5s ease;">
                    </div>
                </div>
                
                <!-- 筛选选项 -->
                <div style="margin: 15px 0;">
                    <!-- 地理范围选择 -->
                    <div style="margin-bottom: 10px;">
                        <label style="color: #764ba2; font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px;">地理范围：</label>
                        <select id="gachaponRange" 
                                style="
                                    width: 100%;
                                    padding: 6px 12px; 
                                    border-radius: 20px; 
                                    border: 2px solid rgba(240, 147, 251, 0.5);
                                    background: rgba(255, 255, 255, 0.7);
                                    color: #764ba2;
                                    cursor: pointer;
                                    font-size: 13px;
                                "
                                onchange="updateGachaponCount()">
                            ${Object.entries(GEOGRAPHIC_RANGES).map(([key, range]) => 
                                `<option value="${key}">${range.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <!-- 餐厅类型选择 -->
                    <div>
                        <label style="color: #764ba2; font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px;">餐厅类型：</label>
                        <select id="gachaponCategory" 
                                style="
                                    width: 100%;
                                    padding: 6px 12px; 
                                    border-radius: 20px; 
                                    border: 2px solid rgba(240, 147, 251, 0.5);
                                    background: rgba(255, 255, 255, 0.7);
                                    color: #764ba2;
                                    cursor: pointer;
                                    font-size: 13px;
                                "
                                onchange="updateGachaponCount()">
                            <option value="all">🎲 所有类型</option>
                            ${categories.map(cat => {
                                const name = RESTAURANT_TYPES[cat]?.name || '其他';
                                return `<option value="${cat}">${name}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    
                    <!-- 显示符合条件的数量 -->
                    <div id="gachaponCount" style="margin-top: 10px; font-size: 12px; color: #999;">
                        计算中...
                    </div>
                </div>
                
                <!-- 扭蛋按钮 -->
                <button id="spinButton" onclick="spinGachapon()" 
                        style="
                            padding: 12px 35px; 
                            background: linear-gradient(45deg, #f093fb, #f5576c);
                            color: white; 
                            border: none; 
                            border-radius: 25px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                            box-shadow: 0 5px 15px rgba(240, 147, 251, 0.4);
                            transition: all 0.3s ease;
                        ">
                    🎯 扭一个！
                </button>
                
                <!-- 结果显示区 -->
                <div id="gachaponResult" style="
                    display: none; 
                    margin-top: 15px; 
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 12px;
                    border: 1px solid rgba(240, 147, 251, 0.3);
                ">
                    <h3 id="resultTitle" style="color: #764ba2; margin-bottom: 8px; font-size: 16px;"></h3>
                    <p id="resultNote" style="color: #666; margin-bottom: 12px; font-size: 13px;"></p>
                    <button onclick="navigateToGachaponResult()" 
                            style="
                                padding: 8px 16px;
                                background: linear-gradient(45deg, #4facfe, #00f2fe);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 13px;
                            ">
                        📍 在地图上查看
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentGachaponModal = modal;
    window.currentGachaponResult = null;
    
    // 初始化显示数量
    setTimeout(() => updateGachaponCount(), 100);
}

function updateGachaponCount() {
    const range = document.getElementById('gachaponRange').value;
    const category = document.getElementById('gachaponCategory').value;
    
    let availablePlaces = allPlaces.filter(p => p.type === 'heart');
    
    // 地理范围筛选
    if (range && range !== 'global') {
        const bounds = GEOGRAPHIC_RANGES[range].bounds;
        if (bounds) {
            availablePlaces = availablePlaces.filter(p => 
                p.lat >= bounds.minLat && p.lat <= bounds.maxLat &&
                p.lng >= bounds.minLng && p.lng <= bounds.maxLng
            );
        }
    }
    
    // 餐厅类型筛选
    if (category !== 'all') {
        availablePlaces = availablePlaces.filter(p => (p.category || 'other') === category);
    }
    
    const countDiv = document.getElementById('gachaponCount');
    if (countDiv) {
        countDiv.textContent = `符合条件的地点：${availablePlaces.length} 个`;
    }
}

// 扭蛋动画
function spinGachapon() {
    if (isSpinning) return;
    
    const range = document.getElementById('gachaponRange').value;
    const category = document.getElementById('gachaponCategory').value;
    let availablePlaces = allPlaces.filter(p => p.type === 'heart');
    
    // 地理范围筛选
    if (range && range !== 'global') {
        const bounds = GEOGRAPHIC_RANGES[range].bounds;
        if (bounds) {
            availablePlaces = availablePlaces.filter(p => 
                p.lat >= bounds.minLat && p.lat <= bounds.maxLat &&
                p.lng >= bounds.minLng && p.lng <= bounds.maxLng
            );
        }
    }
    
    // 餐厅类型筛选
    if (category !== 'all') {
        availablePlaces = availablePlaces.filter(p => (p.category || 'other') === category);
    }
    
    if (availablePlaces.length === 0) {
        showGachaponEmpty();
        return;
    }

    isSpinning = true;
    const spinButton = document.getElementById('spinButton');
    spinButton.disabled = true;
    spinButton.textContent = '扭动中...';
    
    // 切换到转动动画
    const machineImage = document.getElementById('machineImage');
    machineImage.src = '/static/images/gachapon-spinning.gif';
    
    // 播放音效
    playClickSound();
    
    // 3秒后显示结果
    setTimeout(() => {
        // 随机选择一个地点
        const randomIndex = Math.floor(Math.random() * availablePlaces.length);
        const selectedPlace = availablePlaces[randomIndex];
        
        // 恢复静止状态
        machineImage.src = '/static/images/gachapon-idle.png';
        
        // 显示扭蛋球（随机颜色）
        const capsuleResult = document.getElementById('capsuleResult');
        const capsuleColors = ['red', 'blue', 'gold'];
        const randomColor = capsuleColors[Math.floor(Math.random() * capsuleColors.length)];
        
        // 更新扭蛋球图片
        capsuleResult.innerHTML = `
            <img src="/static/images/capsule-${randomColor}.png" 
                style="width: 60px; height: 60px; 
                        animation: bounceIn 0.5s ease;"
                onerror="console.error('Failed to load:', this.src); this.style.display='none';">
        `;
        capsuleResult.style.display = 'block';
        
        // 显示结果
        showGachaponResult(selectedPlace);
        
        isSpinning = false;
        spinButton.disabled = false;
        spinButton.textContent = '🎯 再来！！';
    }, 7800); // 或者你需要的时长
}

// 显示扭蛋结果
function showGachaponResult(place) {
    window.currentGachaponResult = place;
    
    const resultDiv = document.getElementById('gachaponResult');
    const resultTitle = document.getElementById('resultTitle');
    const resultNote = document.getElementById('resultNote');
    
    resultTitle.textContent = `🎊 ${place.name}`;
    resultNote.textContent = place.note || '就是这里！快去探店吧～';
    
    resultDiv.style.display = 'block';
    resultDiv.style.animation = 'fadeIn 0.5s ease';
    
    // 播放成功音效
    showNotification(`✨ 今天就去 ${place.name} 吧！`, 'love');
}

// 显示空结果
function showGachaponEmpty() {
    const resultDiv = document.getElementById('gachaponResult');
    const resultTitle = document.getElementById('resultTitle');
    const resultNote = document.getElementById('resultNote');
    
    resultTitle.textContent = '📝 请添加心愿啦～';
    resultNote.textContent = '还没有想去的地方呢，快去地图上标记几个吧！';
    
    resultDiv.style.display = 'block';
    document.querySelector('[onclick="navigateToGachaponResult()"]').style.display = 'none';
}

// 导航到扭蛋结果
function navigateToGachaponResult() {
    if (!window.currentGachaponResult) return;
    
    const place = window.currentGachaponResult;
    
    // 关闭扭蛋机弹窗
    if (window.currentGachaponModal) {
        window.currentGachaponModal.remove();
    }
    
    // 定位到地点
    map.setView([place.lat, place.lng], 16);
    
    // 打开弹窗
    if (markers[place.id]) {
        markers[place.id].openPopup();
    }
    
    // 添加动画效果
    if (markers[place.id] && markers[place.id]._icon) {
        const icon = markers[place.id]._icon;
        icon.style.animation = 'pulse 2s ease infinite';
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
            
            <!-- 添加餐厅类型选择 -->
            <div style="margin: 10px 0;">
                <label style="font-size: 12px; color: #666;">选择类型：</label>
                <select id="placeCategory" class="popup-input" style="width: 100%; padding: 8px;">
                    <option value="other">其他</option>
                    <option value="chinese">中餐</option>
                    <option value="western">西餐</option>
                    <option value="japanese">日料</option>
                    <option value="korean">韩餐</option>
                    <option value="cafe">咖啡店</option>
                    <option value="dessert">甜品</option>
                    <option value="hotpot">火锅</option>
                    <option value="bbq">烧烤</option>
                    <option value="tea">茶饮</option>
                    <option value="bar">酒吧</option>
                    <option value="fastfood">快餐</option>
                </select>
            </div>
            
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
    if (window.searchTempMarker) {
        map.removeLayer(window.searchTempMarker);
    }
    
    setMode('paw');
    
    const tempMarker = L.marker([lat, lng], {
        icon: createCustomIcon('paw')
    }).addTo(map);
    
    // 处理地址中的特殊字符
    const safeName = address.split(',')[0].replace(/'/g, '').replace(/"/g, '');
    
    const popupContent = `
        <div class="popup-content">
            <div class="popup-title">标记去过的地方</div>
            <input type="text" id="placeName" class="popup-input" 
                   value="${safeName}" placeholder="给这个地方起个名字...">
            
            <!-- 添加餐厅类型选择 -->
            <div style="margin: 10px 0;">
                <label style="font-size: 12px; color: #666;">选择类型：</label>
                <select id="placeCategory" class="popup-input" style="width: 100%; padding: 8px;">
                    <option value="other">其他</option>
                    <option value="chinese">中餐</option>
                    <option value="western">西餐</option>
                    <option value="japanese">日料</option>
                    <option value="korean">韩餐</option>
                    <option value="cafe">咖啡店</option>
                    <option value="dessert">甜品</option>
                    <option value="hotpot">火锅</option>
                    <option value="bbq">烧烤</option>
                    <option value="tea">茶饮</option>
                    <option value="bar">酒吧</option>
                    <option value="fastfood">快餐</option>
                </select>
            </div>
            
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
window.filterMarkers = filterMarkers;
window.RESTAURANT_TYPES = RESTAURANT_TYPES;
window.convertToVisited = convertToVisited;
window.setConvertRating = setConvertRating;
window.confirmConvert = confirmConvert;
window.updateGachaponCount = updateGachaponCount;