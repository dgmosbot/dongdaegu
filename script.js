// 카카오 맵 API 키를 여기에 입력하세요.
const KAKAO_MAP_API_KEY = '50b090ae92d698e12f5dd624d7493f78'; // Replace with your actual API key - Although the provided key seems to be public.

// Google Apps Script 배포 URL을 여기에 입력하세요.
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby2g491jh3tzcnqub3zBzWFiCzgFD3UH8_2W39gsRNidNNnfkzxoDFSpeMaJf8ObaLbSg/exec'; // Use the provided URL

// HTML 요소 가져오기
const mapContainer = document.getElementById('map');
const 담당자필터 = document.getElementById('담당자필터');

// 지도 초기화
let map; // 지도 객체를 저장할 변수 (초기화 지연)

// Geocoder 생성
let geocoder; // Geocoder 객체를 저장할 변수 (초기화 지연)


async function initMap() {
  // 지도 초기화
  const mapOption = {
    center: new kakao.maps.LatLng(35.8786107550773, 128.63360050154185), // KT효목사옥으로 변경
    level: 3,
  };
  map = new kakao.maps.Map(mapContainer, mapOption);

  // Geocoder 생성
  geocoder = new kakao.maps.services.Geocoder();

  // localStorage에서 필터 값을 가져옴
  const saved담당자 = localStorage.getItem('selected담당자');
  const initial담당자 = saved담당자 ? saved담당자 : '전체'; // 저장된 값이 없으면 '전체'로 설정

  loadDataAndDisplayMarkers(initial담당자);
}


// 지도 위에 상황판 추가
const dashboard = document.createElement('div');
dashboard.style.position = 'absolute';
dashboard.style.top = '10px';
dashboard.style.left = '10px';
dashboard.style.padding = '10px';
dashboard.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
dashboard.style.border = '1px solid #ddd';
dashboard.style.borderRadius = '8px';
dashboard.style.boxShadow = '0px 2px 5px rgba(0, 0, 0, 0.2)';
dashboard.style.zIndex = '10';
dashboard.innerHTML = `
  <strong>상황판</strong><br>
  총 주소 수: <span id="totalCount">0</span><br>
  마커 성공: <span id="successCount">0</span><br>
  마커 실패: <span id="failCount">0</span><br><br>
  완료: <span id="status완료">0</span><br>
  양호: <span id="status양호">0</span><br>
  불량: <span id="status불량">0</span><br>
  미점검: <span id="status미점검">0</span><br>
`;
mapContainer.appendChild(dashboard);

let totalCount = 0;
let successCount = 0;
let failCount = 0;
let isDataLoading = false; // Flag to track data loading state

// 로컬 스토리지에서 마지막 담당자 선택값 불러오기
const saved담당자 = localStorage.getItem('selected담당자') || '전체';
담당자필터.value = saved담당자;

async function loadDataAndDisplayMarkers(selected담당자 = '전체') {
  if (isDataLoading) {
    console.log('데이터 로딩 중... 무시하고 리턴합니다.');
    return; // If already loading, ignore new calls
  }

  isDataLoading = true; // Set loading flag to true
  console.log('Data loading 시작...');

  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    const data = await response.json();

    console.log('Data from Google Sheet:', data);

    if (!data || data.length === 0) { // **Check if data is empty or null**
      console.warn('No data received from Google Sheet. Please check the sheet and URL.');
      document.getElementById('totalCount').innerText = 0; // Update dashboard with 0 counts
      document.getElementById('successCount').innerText = 0;
      document.getElementById('failCount').innerText = 0;
      document.getElementById('status완료').innerText = 0;
      document.getElementById('status양호').innerText = 0;
      document.getElementById('status불량').innerText = 0;
      document.getElementById('status미점검').innerText = 0;
      isDataLoading = false;
      return; // Exit the function early if no data
    }

    const 담당자목록 = new Set(['전체']);
    totalCount = data.length;
    successCount = 0;
    failCount = 0;
    // 상태 카운트 초기화
    let 완료Count = 0;
    let 양호Count = 0;
    let 불량Count = 0;
    let 미점검Count = 0;

    removeAllMarkers();

    console.log('총 데이터 건수:', totalCount);

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      console.log(`Processing item ${i+1}/${data.length}:`, item);
      const 호출명칭 = Array.isArray(item.호출명칭) ? item.호출명칭 : [String(item.호출명칭)];
      담당자목록.add(item.담당자);
      if (selected담당자 === '전체' || item.담당자 === selected담당자) {
        // --- START: Corrected to use 'address' (lowercase) ---
        console.log(`[${i+1}/${data.length}] geocodeAddress 호출 전 주소 값:`, item['address'], typeof item['address']);
        const addressToGeocode = item['address'];
        // --- END: Corrected to use 'address' (lowercase) ---
        const latlng = await geocodeAddress(addressToGeocode);
        if (latlng) {
          // --- START: Corrected to use 'address' (lowercase) ---
          console.log(`Geocoding success for address ${i+1}:`, addressToGeocode, latlng);
          // --- END: Corrected to pass status to createMarker ---
          createMarker(latlng.lat, latlng.lng, item['address'], 호출명칭, item['상태']);
          successCount++;
          console.log(`Marker 성공 count 증가: ${successCount}`);
        } else {
          // --- START: Using addressToGeocode which is already item['address'] ---
          console.log(`Geocoding failed for address ${i+1}:`, addressToGeocode);
          // --- END: Using addressToGeocode which is already item['address'] ---
          failCount++;
          console.log(`Marker 실패 count 증가: ${failCount}`);
        }

        // E열 (index 4) 값에 따른 상태 카운트
        let statusValue = (item['상태'] || '').trim(); // E열 (상태 컬럼) - Use header name '상태'
        // let statusValue = item[4] ? String(item[4]).trim() : ''; // E열 (index 4), 공백 처리 추가
        console.log('Status Value (row[4] - trimmed):', statusValue); // 상태 값 확인 (trimmed)

        if (statusValue === '수검완료') {
          완료Count++;
          console.log('  Status matched: 완료'); // 매칭 로그
        } else if (statusValue === '양호') {
          양호Count++;
          console.log('  Status matched: 양호'); // 매칭 로그
        } else if (statusValue === '불량') {
          불량Count++;
          console.log('  Status matched: 불량'); // 매칭 로그
        } else {
          미점검Count++; // 공백, null, undefined는 모두 미점검으로 처리
          console.log('  Status matched: 미점검 (default)'); // 매칭 로그
        }
      }
    }

    // 담당자 필터 옵션 업데이트
    담당자필터.innerHTML = '';
    담당자목록.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      담당자필터.appendChild(option);
    });
    담당자필터.value = selected담당자;

    // 상황판 업데이트
    document.getElementById('totalCount').innerText = totalCount;
    document.getElementById('successCount').innerText = successCount;
    document.getElementById('failCount').innerText = failCount;
    document.getElementById('status완료').innerText = 완료Count;
    document.getElementById('status양호').innerText = 양호Count;
    document.getElementById('status불량').innerText = 불량Count;
    document.getElementById('status미점검').innerText = 미점검Count;

    console.log('상황판 업데이트:', { totalCount, successCount, failCount, 완료Count, 양호Count, 불량Count, 미점검Count });
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  } finally {
    isDataLoading = false; // Reset loading flag in finally block
    console.log('Data loading 완료.');
  }
}

// 담당자 필터 변경 시 선택값 저장 및 재로드
담당자필터.addEventListener('change', (event) => {
  const selected담당자 = event.target.value;
  localStorage.setItem('selected담당자', selected담당자);
  loadDataAndDisplayMarkers(selected담당자);
});

// 페이지 로드 시 마지막 선택된 담당자 값으로 표시
window.addEventListener('load', () => {
  loadDataAndDisplayMarkers(saved담당자);
});

// 주소를 위경도로 변환하는 함수
async function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    if (!address || address.trim() === "") { // **Check for empty or undefined address**
      console.warn("주소가 유효하지 않습니다 (비어있음). Geocoding 생략.");
      resolve(null); // Resolve with null, indicating geocoding failure
      return;
    }
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve({ lat: result[0].y, lng: result[0].x });
      } else {
        console.warn(`주소 변환 실패: ${address}, Status: ${status}`);
        if (status === kakao.maps.services.Status.ZERO_RESULT) {
          console.warn(`주소 변환 결과 없음: ${address}`);
        } else if (status === kakao.maps.services.Status.ERROR) {
          console.error(`주소 변환 중 오류 발생: ${address}`);
        }
        resolve(null); // 실패 시 null 반환
      }
    });
  });
}

// 마커를 생성하고 지도에 추가하는 함수
let markers = []; // 마커를 저장할 배열
let infowindow = null; // 정보 창 (하나의 정보 창만 사용)

// 마커를 생성하고 지도에 추가하는 함수
function createMarker(lat, lng, 주소, 호출명칭, 상태) {
  const content = `
    <div class="infowindow-content" style="max-width: none; display: inline-block;">
      <strong>${주소}</strong><br>
      ${호출명칭.join('<br>')}
    </div>
  `;

  let markerImageSrc = 'https://t1.daumcdn.net/mapjsapi/images/2x/marker.png'; // 기본 마커 (미점검 - Gray)
  if (상태 === '수검완료') {
    markerImageSrc = 'https://i1.daumcdn.net/dmaps/apis/nmarker_green.png'; // 완료 - Green
  } else if (상태 === '양호') {
    markerImageSrc = 'https://i1.daumcdn.net/dmaps/apis/nmarker_blue.png'; // 양호 - Blue
  } else if (상태 === '불량') {
    markerImageSrc = 'https://i1.daumcdn.net/dmaps/apis/nmarker_red.png'; // 불량 - Red
  } else {
    markerImageSrc = 'https://t1.daumcdn.net/mapjsapi/images/2x/marker.png'; // 미점검 또는 기타 - Gray (default)
  }

  // 마커 이미지 옵션 (크기 조절)
  const markerImageSize = new kakao.maps.Size(15, 20); // 마커 크기 변경: 가로 15px, 세로 20px
  const markerImageOptions = {
    spriteOrigin: new kakao.maps.Point(0, 0),
    spriteSize: new kakao.maps.Size(15, 20),
    offset: new kakao.maps.Point(7, 20) // 중앙 하단 기준으로 설정 (크기에 맞춰 offset 조정)
  };
  const markerImage = new kakao.maps.MarkerImage(markerImageSrc, markerImageSize, markerImageOptions);

  const marker = new kakao.maps.Marker({
    map: map,
    position: new kakao.maps.LatLng(lat, lng),
    image: markerImage // 사용자 정의 마커 이미지 설정
  });

  kakao.maps.event.addListener(marker, 'click', () => {
    if (infowindow && infowindow.getMap()) {
      infowindow.close();
      infowindow = null;
    } else {
      infowindow = new kakao.maps.InfoWindow({
        content: content,
        removable: true,
      });
      infowindow.open(map, marker);
    }
  });

  markers.push(marker);
}



// 모든 마커를 제거하는 함수
function removeAllMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = []; // 마커 배열 초기화
  if (infowindow) {
    infowindow.close(); // 정보 창 닫기
    infowindow = null;
  }
}

// 담당자 필터 변경 이벤트 리스너
담당자필터.addEventListener('change', (event) => {
  const selected담당자 = event.target.value;

  // 선택된 담당자를 localStorage에 저장
  localStorage.setItem('selected담당자', selected담당자);

  loadDataAndDisplayMarkers(selected담당자);
});
