let addressData = [];
let provinces = [];
let districts = [];
let wards = [];

// Cache để tối ưu hiệu suất
let filteredCache = {
    provinces: new Map(),
    districts: new Map(),
    wards: new Map()
};

// Load dữ liệu JSON
async function loadData() {
    try {
        const response = await fetch('data.json');
        addressData = await response.json();
        console.log('Đã tải dữ liệu thành công:', addressData.length, 'bản ghi');

        // Tạo danh sách unique cho autocomplete
        createUniqueArrays();

    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
        showAlert('Không thể tải dữ liệu. Vui lòng kiểm tra file data.json', 'error');
    }
}

// Show alert function
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full opacity-0`;

    if (type === 'error') {
        alertDiv.className += ' bg-red-500 text-white';
    } else if (type === 'success') {
        alertDiv.className += ' bg-green-500 text-white';
    } else {
        alertDiv.className += ' bg-blue-500 text-white';
    }

    alertDiv.innerHTML = `
        <div class="flex items-center">
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(alertDiv);

    // Animate in
    setTimeout(() => {
        alertDiv.classList.remove('translate-x-full', 'opacity-0');
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

// Tạo danh sách unique cho autocomplete
function createUniqueArrays() {
    provinces = [...new Set(addressData.map(item => item['TỈNH-THÀNH PHỐ']).filter(item => item))].sort();
    districts = [...new Set(addressData.map(item => item['QUẬN-HUYỆN']).filter(item => item))].sort();
    wards = [...new Set(addressData.map(item => item['PHƯỜNG-XÃ']).filter(item => item))].sort();

    // Clear cache khi tạo lại arrays
    filteredCache = {
        provinces: new Map(),
        districts: new Map(),
        wards: new Map()
    };
}

// Hàm chuẩn hóa chuỗi để so sánh (hỗ trợ tiếng Việt có dấu và không dấu)
function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^\w\s]/g, '') // Loại bỏ ký tự đặc biệt
        .replace(/\s+/g, ' ') // Chuẩn hóa khoảng trắng
        .trim();
}

// Highlight text khớp với từ khóa tìm kiếm
function highlightText(text, searchTerm) {
    if (!searchTerm || !text) return text;

    const normalizedText = normalizeString(text);
    const normalizedTerm = normalizeString(searchTerm);

    if (!normalizedText.includes(normalizedTerm)) return text;

    // Tìm vị trí khớp trong text gốc
    const textWords = text.split(/(\s+)/);
    let result = '';

    for (let word of textWords) {
        const normalizedWord = normalizeString(word);
        if (normalizedWord.includes(normalizedTerm) && normalizedWord.length > 0) {
            result += `<span class="bg-yellow-200 text-yellow-800 px-1 rounded font-semibold">${word}</span>`;
        } else {
            result += word;
        }
    }

    return result;
}

// Tìm kiếm thông minh với fuzzy matching
function smartSearch(dataArray, searchTerm, cacheKey) {
    if (!searchTerm || searchTerm.length < 1) return [];

    const normalizedTerm = normalizeString(searchTerm);

    // Kiểm tra cache
    if (filteredCache[cacheKey] && filteredCache[cacheKey].has(normalizedTerm)) {
        return filteredCache[cacheKey].get(normalizedTerm);
    }

    const results = [];
    const exactMatches = [];
    const startMatches = [];
    const containsMatches = [];

    for (let item of dataArray) {
        const normalizedItem = normalizeString(item);

        if (normalizedItem === normalizedTerm) {
            exactMatches.push(item);
        } else if (normalizedItem.startsWith(normalizedTerm)) {
            startMatches.push(item);
        } else if (normalizedItem.includes(normalizedTerm)) {
            containsMatches.push(item);
        }

        // Giới hạn tổng số kết quả để tránh lag
        if (exactMatches.length + startMatches.length + containsMatches.length >= 15) {
            break;
        }
    }

    // Ưu tiên: exact match > starts with > contains
    const finalResults = [...exactMatches, ...startMatches, ...containsMatches].slice(0, 10);

    // Lưu vào cache
    if (!filteredCache[cacheKey]) {
        filteredCache[cacheKey] = new Map();
    }
    filteredCache[cacheKey].set(normalizedTerm, finalResults);

    return finalResults;
}

// Autocomplete functionality nâng cao
function setupAutocomplete(inputId, getDataArray, cacheKey) {
    const input = document.getElementById(inputId);
    const list = input.parentNode.querySelector('.autocomplete-list');
    let currentSelectedIndex = -1;
    let debounceTimer = null;

    // Debounce input để tránh tìm kiếm quá nhiều
    input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleInput.call(this);
        }, 150); // Delay 150ms
    });

    function handleInput() {
        const value = this.value.trim();
        list.innerHTML = '';
        currentSelectedIndex = -1;

        if (value.length < 1) {
            hideList();
            return;
        }

        // Lấy dữ liệu hiện tại (có thể đã được lọc)
        const currentData = typeof getDataArray === 'function' ? getDataArray() : getDataArray;
        const filtered = smartSearch(currentData, value, cacheKey);

        if (filtered.length === 0) {
            showNoResults(list, value);
            return;
        }

        populateList(filtered, value, list);
        showList();
    }

    function showNoResults(list, searchTerm) {
        const div = document.createElement('div');
        div.className = 'px-4 py-3 text-gray-500 text-center text-sm border-b border-gray-100';
        div.innerHTML = `
            <div class="flex items-center justify-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                Không tìm thấy "${searchTerm}"
            </div>
        `;
        list.appendChild(div);
        showList();
    }

    function populateList(filtered, searchValue, list) {
        filtered.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors duration-150 text-sm lg:text-base autocomplete-item';
            div.setAttribute('data-index', index);
            div.innerHTML = highlightText(item, searchValue);

            // Click handler
            div.addEventListener('click', function (e) {
                e.stopPropagation();
                selectItem(item);
            });

            // Hover handler để sync với keyboard navigation
            div.addEventListener('mouseenter', function () {
                updateSelection(list.querySelectorAll('.autocomplete-item'), index);
                currentSelectedIndex = index;
            });

            list.appendChild(div);
        });
    }

    function selectItem(selectedValue) {
        input.value = selectedValue;
        hideList();
        updateRelatedFields(inputId, selectedValue);

        // Trigger change event
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Focus next field nếu có
        focusNextField(inputId);
    }

    function focusNextField(currentInputId) {
        const fieldOrder = ['province', 'district', 'ward'];
        const currentIndex = fieldOrder.indexOf(currentInputId);
        if (currentIndex >= 0 && currentIndex < fieldOrder.length - 1) {
            const nextField = document.getElementById(fieldOrder[currentIndex + 1]);
            if (nextField) {
                setTimeout(() => nextField.focus(), 100);
            }
        }
    }

    // Keyboard navigation nâng cao
    input.addEventListener('keydown', function (e) {
        const items = list.querySelectorAll('.autocomplete-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (items.length > 0) {
                    currentSelectedIndex = Math.min(currentSelectedIndex + 1, items.length - 1);
                    updateSelection(items, currentSelectedIndex);
                    scrollToSelectedItem(list, items[currentSelectedIndex]);
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (items.length > 0) {
                    currentSelectedIndex = Math.max(currentSelectedIndex - 1, -1);
                    updateSelection(items, currentSelectedIndex);
                    if (currentSelectedIndex >= 0) {
                        scrollToSelectedItem(list, items[currentSelectedIndex]);
                    }
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (currentSelectedIndex >= 0 && items[currentSelectedIndex]) {
                    const selectedText = items[currentSelectedIndex].textContent.trim();
                    selectItem(selectedText);
                } else if (this.value.trim()) {
                    // Nếu không có item nào được chọn nhưng có text, thực hiện tìm kiếm
                    if (inputId === 'ward') {
                        searchAddress();
                    }
                }
                break;

            case 'Escape':
                e.preventDefault();
                hideList();
                currentSelectedIndex = -1;
                break;

            case 'Tab':
                hideList();
                currentSelectedIndex = -1;
                break;
        }
    });

    function scrollToSelectedItem(container, item) {
        if (!item) return;

        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        if (itemRect.bottom > containerRect.bottom) {
            container.scrollTop += itemRect.bottom - containerRect.bottom;
        } else if (itemRect.top < containerRect.top) {
            container.scrollTop -= containerRect.top - itemRect.top;
        }
    }

    function updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            item.classList.remove('bg-blue-500', 'text-white');
            item.classList.add('hover:bg-blue-50');

            if (index === selectedIndex) {
                item.classList.remove('hover:bg-blue-50');
                item.classList.add('bg-blue-500', 'text-white');
            }
        });
    }

    function showList() {
        list.classList.remove('hidden');
        list.style.zIndex = '1000';
    }

    function hideList() {
        list.classList.add('hidden');
        currentSelectedIndex = -1;
    }

    // Focus/blur handlers
    input.addEventListener('focus', function () {
        if (this.value.trim().length >= 1) {
            setTimeout(() => handleInput.call(this), 100);
        }
    });

    input.addEventListener('blur', function () {
        // Delay để cho phép click vào item
        setTimeout(() => {
            if (!list.matches(':hover')) {
                hideList();
            }
        }, 150);
    });
}

// Lọc liên quan thông minh
function updateRelatedFields(inputId, selectedValue) {
    if (inputId === 'province') {
        // Lọc quận/huyện theo tỉnh được chọn
        const relatedDistricts = [...new Set(
            addressData
                .filter(item => item['TỈNH-THÀNH PHỐ'] === selectedValue)
                .map(item => item['QUẬN-HUYỆN'])
                .filter(item => item)
        )].sort();

        districts = relatedDistricts;

        // Clear và focus các trường liên quan
        const districtInput = document.getElementById('district');
        const wardInput = document.getElementById('ward');

        districtInput.value = '';
        wardInput.value = '';

        // Clear cache của district và ward
        filteredCache.districts.clear();
        filteredCache.wards.clear();

        showAlert(`Đã lọc ${relatedDistricts.length} quận/huyện theo tỉnh "${selectedValue}"`, 'success');

    } else if (inputId === 'district') {
        const provinceValue = document.getElementById('province').value;

        // Lọc phường/xã theo quận/huyện được chọn
        const relatedWards = [...new Set(
            addressData
                .filter(item => {
                    const matchProvince = !provinceValue || item['TỈNH-THÀNH PHỐ'] === provinceValue;
                    const matchDistrict = item['QUẬN-HUYỆN'] === selectedValue;
                    return matchProvince && matchDistrict;
                })
                .map(item => item['PHƯỜNG-XÃ'])
                .filter(item => item)
        )].sort();

        wards = relatedWards;

        // Clear ward field
        const wardInput = document.getElementById('ward');
        wardInput.value = '';

        // Clear cache của ward
        filteredCache.wards.clear();

        showAlert(`Đã lọc ${relatedWards.length} phường/xã theo quận/huyện "${selectedValue}"`, 'success');
    }
}

// Hide autocomplete when clicking outside (cải tiến)
let clickOutsideHandler = function (e) {
    const autocompleteContainers = document.querySelectorAll('.autocomplete-container');
    let clickedInside = false;

    autocompleteContainers.forEach(container => {
        if (container.contains(e.target)) {
            clickedInside = true;
        }
    });

    if (!clickedInside) {
        document.querySelectorAll('.autocomplete-list').forEach(list => {
            list.classList.add('hidden');
        });
    }
};

document.addEventListener('click', clickOutsideHandler);

// Hàm tìm kiếm địa chỉ (cải tiến)
function searchAddress() {
    const province = document.getElementById('province').value.trim();
    const district = document.getElementById('district').value.trim();
    const ward = document.getElementById('ward').value.trim();

    if (!province && !district && !ward) {
        showAlert('Vui lòng nhập ít nhất một thông tin để tìm kiếm', 'error');
        // Focus vào field đầu tiên
        document.getElementById('province').focus();
        return;
    }

    // Hide all autocomplete lists
    document.querySelectorAll('.autocomplete-list').forEach(list => {
        list.classList.add('hidden');
    });

    // Tìm kiếm với thuật toán cải tiến
    const results = addressData.filter(item => {
        const matchProvince = !province || normalizeString(item['TỈNH-THÀNH PHỐ']).includes(normalizeString(province));
        const matchDistrict = !district || normalizeString(item['QUẬN-HUYỆN']).includes(normalizeString(district));
        const matchWard = !ward || normalizeString(item['PHƯỜNG-XÃ']).includes(normalizeString(ward));

        return matchProvince && matchDistrict && matchWard;
    });

    displayResults(results, { province, district, ward });
}

// Hiển thị kết quả với thông tin tìm kiếm
function displayResults(results, searchTerms) {
    const resultsDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('no-results');
    const resultContent = document.getElementById('result-content');

    if (results.length === 0) {
        resultsDiv.classList.add('hidden');
        noResultsDiv.classList.remove('hidden');

        // Cập nhật thông báo không có kết quả
        const searchInfo = Object.entries(searchTerms)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}: "${value}"`)
            .join(', ');

        noResultsDiv.innerHTML = `
            <div class="text-gray-400 mb-4">
                <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-700 mb-2">Không tìm thấy kết quả</h3>
            <p class="text-gray-500 mb-4">Không tìm thấy kết quả phù hợp với: ${searchInfo}</p>
            <button onclick="clearForm()" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Thử lại
            </button>
        `;

        noResultsDiv.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    noResultsDiv.classList.add('hidden');
    resultsDiv.classList.remove('hidden');

    resultContent.innerHTML = results.map((item, index) => `
        <div class="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg border border-gray-200 mb-4 shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-[1.01]">
            <div class="flex items-center mb-4">
                <div class="bg-gradient-to-r from-blue-500 to-purple-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 shadow-md">
                    ${index + 1}
                </div>
                <h3 class="text-lg lg:text-xl font-bold text-gray-800">Kết quả ${index + 1}</h3>
                ${results.length > 5 && index < 3 ? '<span class="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Khớp nhất</span>' : ''}
            </div>
            
            <div class="space-y-3">
                <div class="flex flex-col lg:flex-row">
                    <span class="text-gray-600 font-medium mb-1 lg:mb-0 lg:w-48 lg:flex-shrink-0">Địa chỉ cũ:</span>
                    <span class="text-gray-800 lg:flex-1">${highlightText([item['PHƯỜNG-XÃ'], item['QUẬN-HUYỆN'], item['TỈNH-THÀNH PHỐ']].filter(x => x).join(', '), Object.values(searchTerms).filter(x => x).join(' '))}</span>
                </div>
                
                <div class="flex flex-col lg:flex-row">
                    <span class="text-gray-600 font-medium mb-1 lg:mb-0 lg:w-48 lg:flex-shrink-0">Tỉnh/Thành phố mới:</span>
                    <span class="text-blue-700 font-semibold lg:flex-1">${item['Tỉnh-Thành phố mới'] || 'Không có thông tin'}</span>
                </div>
                
                <div class="flex flex-col lg:flex-row">
                    <span class="text-gray-600 font-medium mb-1 lg:mb-0 lg:w-48 lg:flex-shrink-0">Xã/Phường mới:</span>
                    <span class="text-blue-700 font-semibold lg:flex-1">${item['Xã-Phường mới'] || 'Không có thông tin'}</span>
                </div>
                
                ${item['Luật'] && item['Luật'] !== '' && item['Luật'] !== ' ' ? `
                    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mt-4">
                        <div class="flex items-start">
                            <svg class="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.952.542-5.618 1.491M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                            <div>
                                <h4 class="font-semibold text-blue-800 mb-1">Căn cứ pháp lý:</h4>
                                <p class="text-blue-700 text-sm">${item['Luật']}</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${item['ghi chú'] && item['ghi chú'] !== '' && item['ghi chú'] !== ' ' ? `
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mt-3">
                        <div class="flex items-start">
                            <svg class="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            <div>
                                <h4 class="font-semibold text-yellow-800 mb-1">Ghi chú:</h4>
                                <p class="text-yellow-700 text-sm">${item['ghi chú']}</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Scroll to results với animation mượt
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showAlert(
        `Tìm thấy ${results.length} kết quả${results.length > 10 ? ` (hiển thị tất cả)` : ''}`,
        'success'
    );
}

// Xóa form (cải tiến)
function clearForm() {
    const inputs = ['province', 'district', 'ward'];

    inputs.forEach(id => {
        const input = document.getElementById(id);
        input.value = '';
        input.classList.remove('border-green-500');
    });

    document.getElementById('results').classList.add('hidden');
    document.getElementById('no-results').classList.add('hidden');

    // Hide all autocomplete lists
    document.querySelectorAll('.autocomplete-list').forEach(list => {
        list.classList.add('hidden');
    });

    // Reset arrays và cache
    createUniqueArrays();

    // Focus vào field đầu tiên
    document.getElementById('province').focus();

    showAlert('Đã xóa form thành công', 'success');
}

// Initialize với các tính năng nâng cao
document.addEventListener('DOMContentLoaded', function () {
    loadData().then(() => {
        // Setup autocomplete với function để lấy data động
        setupAutocomplete('province', () => provinces, 'provinces');
        setupAutocomplete('district', () => districts, 'districts');
        setupAutocomplete('ward', () => wards, 'wards');

        // Thêm các shortcut keys
        document.addEventListener('keydown', function (e) {
            // Ctrl/Cmd + K để focus vào tìm kiếm
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('province').focus();
            }

            // Ctrl/Cmd + Enter để tìm kiếm
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                searchAddress();
            }

            // Ctrl/Cmd + Backspace để xóa form
            if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
                e.preventDefault();
                clearForm();
            }
        });
    });
});