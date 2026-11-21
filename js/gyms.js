/* ============================================================
 * gyms.js — 배드민턴 체육관 목록 + '자주 가는 체육관' 즐겨찾기
 *
 *  · 지도에 처음부터 보여 줄 체육관 목록입니다(이름·동네·좌표·코트 수·운영 시간·요금).
 *    서울 시설공단·구청 공개 자료와 공개 지도 정보를 기준으로 정리했고,
 *    앱에 이미 나오던 '나래울'(동탄)도 함께 담았습니다.
 *  · bm-v1.44.0 — 서울·수도권 13곳에서 전국 7개 권역 120곳으로 넓혔습니다.
 *    좌표·주소는 전부 카카오맵·구글 지도 장소 DB에서 조회한 실제 시설 값이고,
 *    지어낸 이름·추정 좌표는 없습니다(조회 기록 work/gym-harvest/venues-evidence.json).
 *    배드민턴 전용구장과, 배드민턴을 칠 수 있는 시민 체육관·국민체육센터를 함께 담았고
 *    권역(region)으로 빠르게 골라 볼 수 있습니다.
 *  · 내 위치 기준 거리(Haversine, km)와 '가까운 순' 정렬, 그리고 프로필·모집글에
 *    적힌 체육관 이름을 목록의 체육관과 이어 주는 matchVenue 를 함께 둡니다.
 *  · 운영 시간·요금은 바뀔 수 있어 화면에도 그렇게 적어 둡니다(모르는 곳은 비워 둡니다).
 *  · 즐겨찾기는 서버에 보내지 않고 이 기기(localStorage)에만, 계정마다 따로 저장합니다.
 *    (시트 26칸은 건드리지 않습니다 — routine.js 와 같은 방식)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var KEY = 'bm_gym_fav_v1';

  /* 좌표는 소수점 5자리(약 1m)까지. lat·lng 는 지도 핀을 찍는 데 씁니다. */
  var VENUES = [
    {
      id: 'gwangjang', name: '광장동실내배드민턴장', area: '광진구 광장동', region: '서울',
      addr: '서울 광진구 천호대로140길 40', lat: 37.54438, lng: 127.10013,
      courts: null, hours: '', fee: '', tel: '02-458-9062',
      tags: ['배드민턴 전용']
    },
    {
      id: 'bulamsan', name: '불암산배드민턴장', area: '노원구 공릉동', region: '서울',
      addr: '서울 노원구 중계로 36', lat: 37.63871, lng: 127.08323,
      courts: null, hours: '', fee: '', tel: '02-2289-6856',
      tags: ['배드민턴 전용']
    },
    {
      id: 'hongje', name: '홍제배드민턴장', area: '서대문구 홍제동', region: '서울',
      addr: '서울 서대문구 홍제동 5-6', lat: 37.59504, lng: 126.94937,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'saemteo', name: '샘터배드민턴장', area: '강동구 강일동', region: '서울',
      addr: '서울 강동구 동남로 990', lat: 37.56214, lng: 127.15755,
      courts: null, hours: '', fee: '', tel: '02-2045-7875',
      tags: ['배드민턴 전용']
    },
    {
      id: 'seocho', name: '서초종합체육관', area: '서초구 우면동', region: '서울',
      addr: '서울 서초구 양재대로12길 73-48', lat: 37.45895, lng: 127.04231,
      courts: null, hours: '', fee: '', tel: '02-577-9600',
      tags: ['실내체육관']
    },
    {
      id: 'yangcheon', name: '양천구민체육센터', area: '양천구 목동', region: '서울',
      addr: '서울 양천구 목동동로 87', lat: 37.51633, lng: 126.86434,
      courts: null, hours: '', fee: '', tel: '02-2652-1792',
      tags: ['구민체육센터']
    },
    {
      id: 'eunpyeong', name: '은평다목적체육관', area: '은평구 진관동', region: '서울',
      addr: '서울 은평구 진관1로 52', lat: 37.63119, lng: 126.9252,
      courts: null, hours: '', fee: '', tel: '02-350-5325',
      tags: ['다목적 체육관']
    },
    {
      id: 'jungnang', name: '중랑구민체육센터', area: '중랑구 신내동', region: '서울',
      addr: '서울 중랑구 신내로15길 189', lat: 37.6151, lng: 127.08758,
      courts: null, hours: '', fee: '', tel: '02-3423-1070',
      tags: ['구민체육센터']
    },
    {
      id: 'ydp1', name: '영등포 제1스포츠센터', area: '영등포구 신길동', region: '서울',
      addr: '서울 영등포구 신풍로 1', lat: 37.50052, lng: 126.90633,
      courts: null, hours: '', fee: '', tel: '02-2650-1500',
      tags: ['스포츠센터']
    },
    {
      id: 'dongdaemun', name: '동대문구체육관', area: '동대문구 장안동', region: '서울',
      addr: '서울 동대문구 답십리로 210-3', lat: 37.57229, lng: 127.06395,
      courts: null, hours: '', fee: '', tel: '02-2247-9611',
      tags: ['실내체육관']
    },
    {
      id: 'gangnam', name: '강남구민체육관', area: '강남구 개포동', region: '서울',
      addr: '서울 강남구 개포로28길 47', lat: 37.47711, lng: 127.0519,
      courts: null, hours: '', fee: '', tel: '02-2176-0871',
      tags: ['실내체육관']
    },
    {
      id: 'naraeul', name: '나래울 배드민턴장', area: '경기 화성 동탄', region: '경기·인천',
      addr: '경기 화성시 동탄구 여울로2길 33-2', lat: 37.20582, lng: 127.05158,
      courts: 10, hours: '1~5부 운영 (2시간 이용)', fee: '일권 성인 1,500원', tel: '031-8015-0975',
      tags: ['배드민턴 전용', '동탄']
    },
    {
      id: 'chilbo', name: '서수원칠보체육관', area: '수원시 권선구', region: '경기·인천',
      addr: '경기 수원시 권선구 서수원로577번길 171', lat: 37.27627, lng: 126.9483,
      courts: null, hours: '', fee: '', tel: '031-259-5400',
      tags: ['실내체육관']
    },
    {
      id: 'suwon-gym', name: '수원시국민체육센터', area: '수원시 장안구', region: '경기·인천',
      addr: '경기 수원시 장안구 경수대로 893', lat: 37.29724, lng: 127.00858,
      courts: null, hours: '', fee: '', tel: '031-240-2701',
      tags: ['국민체육센터']
    },
    {
      id: 'gwanggyo-well', name: '광교웰빙국민체육센터', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 웰빙타운로 71', lat: 37.30509, lng: 127.04315,
      courts: null, hours: '', fee: '', tel: '031-259-4600',
      tags: ['국민체육센터']
    },
    {
      id: 'yeongtong', name: '영통복합체육센터', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 영통동 1052-3', lat: 37.2644, lng: 127.08517,
      courts: null, hours: '', fee: '', tel: '070-4104-8640',
      tags: ['실내체육관']
    },
    {
      id: 'gwanggyo', name: '광교체육센터', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 혜령로 12', lat: 37.28332, lng: 127.0511,
      courts: null, hours: '', fee: '', tel: '031-215-9205',
      tags: ['실내체육관']
    },
    {
      id: 'yeongheung', name: '영흥체육관', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 영통로 435', lat: 37.26052, lng: 127.07319,
      courts: null, hours: '', fee: '', tel: '031-273-0335',
      tags: ['실내체육관']
    },
    {
      id: 'suwon-badminton', name: '수원시배드민턴전용경기장', area: '수원시 장안구', region: '경기·인천',
      addr: '경기 수원시 장안구 정조로 1067', lat: 37.30064, lng: 127.00426,
      courts: null, hours: '', fee: '', tel: '070-4258-3221',
      tags: ['배드민턴 전용']
    },
    {
      id: 'manseok', name: '만석공원 배드민턴전용경기장', area: '수원시 장안구', region: '경기·인천',
      addr: '경기 수원시 장안구 정조로 1087', lat: 37.30048, lng: 127.00426,
      courts: null, hours: '', fee: '', tel: '031-255-6222',
      tags: ['배드민턴 전용']
    },
    {
      id: 'mangpo', name: '망포종합체육센터', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 망포동 234-9', lat: 37.23816, lng: 127.0516,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'maewon', name: '매원고등학교 체육관', area: '수원시 영통구', region: '경기·인천',
      addr: '경기 수원시 영통구 삼성로213번길 120', lat: 37.26554, lng: 127.05435,
      courts: null, hours: '', fee: '', tel: '+82 31-218-1543',
      tags: ['학교 체육관']
    },
    {
      id: 'guun', name: '서수원구운체육관', area: '수원시 권선구', region: '경기·인천',
      addr: '경기 수원시 권선구 구운로14번길 42', lat: 37.27875, lng: 126.97584,
      courts: null, hours: '', fee: '', tel: '031-278-6492',
      tags: ['실내체육관']
    },
    {
      id: 'hwaseong-indoor', name: '화성시 실내배드민턴장', area: '화성시 동탄구', region: '경기·인천',
      addr: '경기 화성시 동탄구 동탄신리천로 221', lat: 37.18622, lng: 127.10283,
      courts: null, hours: '', fee: '', tel: '031-378-6921',
      tags: ['배드민턴 전용']
    },
    {
      id: 'dongtan-gym', name: '동탄다목적체육관', area: '화성시 동탄구', region: '경기·인천',
      addr: '경기 화성시 동탄구 동탄나루로 56', lat: 37.19074, lng: 127.08062,
      courts: null, hours: '', fee: '', tel: '031-8015-1738',
      tags: ['다목적 체육관']
    },
    {
      id: 'banwol', name: '화성반월체육센터', area: '화성시 병점구', region: '경기·인천',
      addr: '경기 화성시 병점구 반월체육공원길 92', lat: 37.23038, lng: 127.05404,
      courts: null, hours: '', fee: '', tel: '031-273-0530',
      tags: ['실내체육관']
    },
    {
      id: 'osan-os', name: '오산오색문화체육센터', area: '오산시', region: '경기·인천',
      addr: '경기 오산시 오산천로 271', lat: 37.15631, lng: 127.07134,
      courts: null, hours: '', fee: '', tel: '031-371-1900',
      tags: ['스포츠센터']
    },
    {
      id: 'osan-airdome', name: '오산에어돔 배드민턴구장', area: '오산시', region: '경기·인천',
      addr: '경기 오산시 죽담4로 12-10', lat: 37.16766, lng: 127.04865,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'pyeongtaek-ichung', name: '이충문화체육센터', area: '평택시', region: '경기·인천',
      addr: '경기 평택시 장안웃길 149', lat: 37.06602, lng: 127.07073,
      courts: null, hours: '', fee: '', tel: '031-8024-7440',
      tags: ['실내체육관']
    },
    {
      id: 'anyang-indoor', name: '안양종합운동장 실내체육관', area: '안양시 동안구', region: '경기·인천',
      addr: '경기 안양시 동안구 평촌대로 389', lat: 37.40506, lng: 126.94845,
      courts: null, hours: '', fee: '', tel: '031-389-5227',
      tags: ['실내체육관']
    },
    {
      id: 'anyang-badminton', name: '안양배드민턴장', area: '안양시 만안구', region: '경기·인천',
      addr: '경기 안양시 만안구 안양로 589', lat: 37.42133, lng: 126.90629,
      courts: null, hours: '', fee: '', tel: '010-8730-7633',
      tags: ['배드민턴 전용']
    },
    {
      id: 'bucheon-badminton', name: '부천배드민턴전용체육관', area: '부천시 소사구', region: '경기·인천',
      addr: '경기 부천시 소사구 은성로2번길 6', lat: 37.47514, lng: 126.79044,
      courts: null, hours: '', fee: '', tel: '032-340-5380',
      tags: ['배드민턴 전용']
    },
    {
      id: 'siheung-badminton', name: '정왕동체육공원 배드민턴전용체육관', area: '시흥시 정왕동', region: '경기·인천',
      addr: '경기 시흥시 역전로 50', lat: 37.33961, lng: 126.75703,
      courts: null, hours: '', fee: '', tel: '031-8084-0140',
      tags: ['배드민턴 전용']
    },
    {
      id: 'gimpo', name: '김포생활체육관', area: '김포시', region: '경기·인천',
      addr: '경기 김포시 김포한강8로 198-3', lat: 37.64037, lng: 126.64475,
      courts: null, hours: '', fee: '', tel: '031-996-8020',
      tags: ['실내체육관']
    },
    {
      id: 'uijeongbu-chu', name: '추동배드민턴장', area: '의정부시', region: '경기·인천',
      addr: '경기 의정부시 능곡로26번길 28-40', lat: 37.73802, lng: 127.06216,
      courts: null, hours: '', fee: '', tel: '031-840-9042',
      tags: ['배드민턴 전용']
    },
    {
      id: 'uijeongbu-singok', name: '신곡실내배드민턴장', area: '의정부시', region: '경기·인천',
      addr: '경기 의정부시 금신로257번길 40', lat: 37.74307, lng: 127.06571,
      courts: null, hours: '', fee: '', tel: '031-821-0980',
      tags: ['배드민턴 전용']
    },
    {
      id: 'namyangju', name: '남양주체육문화센터', area: '남양주시', region: '경기·인천',
      addr: '경기 남양주시 다산지금로 91', lat: 37.60535, lng: 127.17666,
      courts: null, hours: '', fee: '', tel: '031-560-1301',
      tags: ['실내체육관']
    },
    {
      id: 'hanam', name: '하남종합운동장 국민체육센터', area: '하남시', region: '경기·인천',
      addr: '경기 하남시 아리수로 600', lat: 37.5671, lng: 127.19507,
      courts: null, hours: '', fee: '', tel: '031-790-2000',
      tags: ['국민체육센터']
    },
    {
      id: 'yongin-indoor', name: '용인시실내체육관', area: '용인시 처인구', region: '경기·인천',
      addr: '경기 용인시 처인구 경안천로 76', lat: 37.23741, lng: 127.21341,
      courts: null, hours: '', fee: '', tel: '031-323-5211',
      tags: ['실내체육관']
    },
    {
      id: 'icheon', name: '이천시눈높이배드민턴체육관', area: '이천시 부발읍', region: '경기·인천',
      addr: '경기 이천시 부발읍 중부대로 1696', lat: 37.28777, lng: 127.49703,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'paju-badminton', name: '파주시배드민턴전용구장', area: '파주시 금촌동', region: '경기·인천',
      addr: '경기 파주시 금촌동 714', lat: 37.76369, lng: 126.76192,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'paju-unjeong', name: '운정배드민턴전용구장', area: '파주시 운정동', region: '경기·인천',
      addr: '경기 파주시 가람로150번길 41-33', lat: 37.73894, lng: 126.76638,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'gwangmyeong', name: '광명국민체육센터', area: '광명시', region: '경기·인천',
      addr: '경기 광명시 사성로 74', lat: 37.4869, lng: 126.86552,
      courts: null, hours: '', fee: '', tel: '02-2610-7360',
      tags: ['국민체육센터']
    },
    {
      id: 'songdo', name: '송도체육센터', area: '인천 연수구', region: '경기·인천',
      addr: '인천 연수구 송도과학로51번길 80', lat: 37.38662, lng: 126.6696,
      courts: null, hours: '', fee: '', tel: '032-830-8067',
      tags: ['실내체육관']
    },
    {
      id: 'bupyeong-gym', name: '부평구 다목적실내체육관', area: '인천 부평구', region: '경기·인천',
      addr: '인천 부평구 부평대로296번길 33', lat: 37.5187, lng: 126.72312,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['다목적 체육관']
    },
    {
      id: 'ilsin', name: '일신배드민턴장', area: '인천 부평구', region: '경기·인천',
      addr: '인천 부평구 경인로 1158', lat: 37.48422, lng: 126.74823,
      courts: null, hours: '', fee: '', tel: '032-262-9298',
      tags: ['배드민턴 전용']
    },
    {
      id: 'namdong', name: '남동국민체육센터', area: '인천 남동구', region: '경기·인천',
      addr: '인천 남동구 백범로124번길 94', lat: 37.45798, lng: 126.73629,
      courts: null, hours: '', fee: '', tel: '032-460-0600',
      tags: ['국민체육센터']
    },
    {
      id: 'michuhol', name: '미추홀구 국민체육센터', area: '인천 미추홀구', region: '경기·인천',
      addr: '인천 미추홀구 경인로42번길 57', lat: 37.46192, lng: 126.64924,
      courts: null, hours: '', fee: '', tel: '032-225-2070',
      tags: ['국민체육센터']
    },
    {
      id: 'chuncheon-hoban', name: '호반체육관', area: '춘천시', region: '강원',
      addr: '강원특별자치도 춘천시 우석로 102', lat: 37.86388, lng: 127.75733,
      courts: null, hours: '', fee: '', tel: '033-263-7304',
      tags: ['실내체육관']
    },
    {
      id: 'chuncheon-bomnae', name: '봄내체육관', area: '춘천시', region: '강원',
      addr: '강원특별자치도 춘천시 평화로 25', lat: 37.8813, lng: 127.71861,
      courts: null, hours: '', fee: '', tel: '033-257-7800',
      tags: ['실내체육관']
    },
    {
      id: 'chuncheon-joy', name: '즐거운배드민턴장', area: '춘천시 동내면', region: '강원',
      addr: '강원특별자치도 춘천시 동내면 순환대로 878-2', lat: 37.85775, lng: 127.77766,
      courts: null, hours: '', fee: '', tel: '010-5260-9722',
      tags: ['배드민턴 전용']
    },
    {
      id: 'wonju', name: '원주종합체육관', area: '원주시', region: '강원',
      addr: '강원특별자치도 원주시 서원대로 281', lat: 37.33905, lng: 127.94207,
      courts: null, hours: '', fee: '', tel: '033-749-4715',
      tags: ['실내체육관']
    },
    {
      id: 'wonju-center', name: '원주국민체육센터', area: '원주시', region: '강원',
      addr: '강원특별자치도 원주시 남원로 551', lat: 37.33401, lng: 127.9466,
      courts: null, hours: '', fee: '', tel: '033-749-4700',
      tags: ['국민체육센터']
    },
    {
      id: 'gangneung', name: '강릉실내종합체육관', area: '강릉시', region: '강원',
      addr: '강원특별자치도 강릉시 종합운동장길 32', lat: 37.77378, lng: 128.89251,
      courts: null, hours: '', fee: '', tel: '033-660-3341',
      tags: ['실내체육관']
    },
    {
      id: 'gangneung-center', name: '강릉국민체육센터', area: '강릉시', region: '강원',
      addr: '강원특별자치도 강릉시 수리골길 76', lat: 37.77706, lng: 128.89698,
      courts: null, hours: '', fee: '', tel: '033-640-4551',
      tags: ['국민체육센터']
    },
    {
      id: 'sokcho', name: '속초시실내체육관', area: '속초시', region: '강원',
      addr: '강원특별자치도 속초시 관광로363번길 14', lat: 38.1932, lng: 128.53775,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'donghae', name: '동해 웰빙레포츠타운 배드민턴장', area: '동해시', region: '강원',
      addr: '강원특별자치도 동해시 덕골길 10', lat: 37.51461, lng: 129.09965,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'hongcheon', name: '홍천종합체육관', area: '홍천군 홍천읍', region: '강원',
      addr: '강원특별자치도 홍천군 홍천읍 태학여내길 22', lat: 37.70869, lng: 127.90812,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'taebaek', name: '태백고원체육관', area: '태백시', region: '강원',
      addr: '강원특별자치도 태백시 태백로 1485', lat: 37.13403, lng: 129.00594,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'daejeon-chungmu', name: '충무체육관', area: '대전 중구', region: '충청',
      addr: '대전 중구 대종로 373', lat: 36.31801, lng: 127.43046,
      courts: null, hours: '', fee: '', tel: '042-724-3212',
      tags: ['실내체육관']
    },
    {
      id: 'daejeon-yuseong', name: '유성종합스포츠센터', area: '대전 유성구', region: '충청',
      addr: '대전 유성구 유성대로 978', lat: 36.37853, lng: 127.34436,
      courts: null, hours: '', fee: '', tel: '042-862-7333',
      tags: ['스포츠센터']
    },
    {
      id: 'sejong', name: '세종시민체육관', area: '세종시 조치원읍', region: '충청',
      addr: '세종특별자치시 조치원읍 대첩로 116', lat: 36.59519, lng: 127.28439,
      courts: null, hours: '', fee: '', tel: '044-301-3318',
      tags: ['실내체육관']
    },
    {
      id: 'cheongju-osong', name: '오송국민체육센터', area: '청주시 흥덕구', region: '충청',
      addr: '충북 청주시 흥덕구 오송읍 오송생명12로 130', lat: 36.6243, lng: 127.31182,
      courts: null, hours: '', fee: '', tel: '043-234-3347',
      tags: ['국민체육센터']
    },
    {
      id: 'chungju', name: '충주체육관', area: '충주시', region: '충청',
      addr: '충북 충주시 예성로 266', lat: 36.9817, lng: 127.93668,
      courts: null, hours: '', fee: '', tel: '043-850-3904',
      tags: ['실내체육관']
    },
    {
      id: 'cheonan-indoor', name: '천안시실내배드민턴장', area: '천안시 동남구', region: '충청',
      addr: '충남 천안시 동남구 천안대로 357', lat: 36.77924, lng: 127.16467,
      courts: null, hours: '', fee: '', tel: '041-529-5115',
      tags: ['배드민턴 전용']
    },
    {
      id: 'cheonan-yugwansun', name: '유관순체육관', area: '천안시 서북구', region: '충청',
      addr: '충남 천안시 서북구 번영로 208', lat: 36.82088, lng: 127.11422,
      courts: null, hours: '', fee: '', tel: '041-529-5000',
      tags: ['실내체육관']
    },
    {
      id: 'asan', name: '아산시민체육관', area: '아산시', region: '충청',
      addr: '충남 아산시 신정로 685', lat: 36.77883, lng: 126.98501,
      courts: null, hours: '', fee: '', tel: '041-536-8810',
      tags: ['실내체육관']
    },
    {
      id: 'gongju', name: '백제체육관', area: '공주시', region: '충청',
      addr: '충남 공주시 고마나루길 51-14', lat: 36.46257, lng: 127.10685,
      courts: null, hours: '', fee: '', tel: '041-840-2182',
      tags: ['실내체육관']
    },
    {
      id: 'jecheon', name: '제천배드민턴체육관', area: '제천시', region: '충청',
      addr: '충북 제천시 청전대로 13', lat: 37.1453, lng: 128.2012,
      courts: null, hours: '', fee: '', tel: '043-652-1020',
      tags: ['배드민턴 전용']
    },
    {
      id: 'seosan', name: '서산시민체육관', area: '서산시', region: '충청',
      addr: '충남 서산시 안견로 661', lat: 36.79779, lng: 126.4362,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'boryeong', name: '보령배드민턴구장', area: '보령시', region: '충청',
      addr: '충남 보령시 한내로 78-12', lat: 36.34411, lng: 126.60991,
      courts: null, hours: '', fee: '', tel: '041-930-3327',
      tags: ['배드민턴 전용']
    },
    {
      id: 'gwangju-yeomju', name: '염주종합체육관', area: '광주 서구', region: '전라',
      addr: '전남광주통합특별시 서구 금화로 278', lat: 35.13539, lng: 126.87886,
      courts: null, hours: '', fee: '', tel: '062-604-1821',
      tags: ['실내체육관']
    },
    {
      id: 'gwangju-pungam', name: '풍암국민체육센터', area: '광주 서구', region: '전라',
      addr: '전남광주통합특별시 서구 풍암동 396-19', lat: 35.1298, lng: 126.88112,
      courts: null, hours: '', fee: '', tel: '+82 62-350-4567',
      tags: ['국민체육센터']
    },
    {
      id: 'gwangju-cheomdan', name: '첨단생활체육공원 실내배드민턴장', area: '광주 광산구', region: '전라',
      addr: '전남광주통합특별시 광산구 산월동 819-8', lat: 35.21321, lng: 126.85284,
      courts: null, hours: '', fee: '', tel: '+82 62-960-9988',
      tags: ['배드민턴 전용']
    },
    {
      id: 'jeonju-indoor', name: '전주실내배드민턴장', area: '전주시 덕진구', region: '전라',
      addr: '전북특별자치도 전주시 덕진구 소리로 6', lat: 35.85337, lng: 127.1357,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'jeonju-eoulrim', name: '전주어울림국민체육센터', area: '전주시 덕진구', region: '전라',
      addr: '전북특별자치도 전주시 덕진구 보훈누리로 61', lat: 35.85501, lng: 127.12589,
      courts: null, hours: '', fee: '', tel: '063-239-2708',
      tags: ['국민체육센터']
    },
    {
      id: 'iksan-kimdongmoon', name: '김동문배드민턴체육관', area: '익산시', region: '전라',
      addr: '전북특별자치도 익산시 익산대로 355', lat: 35.9576, lng: 126.95206,
      courts: null, hours: '', fee: '', tel: '063-859-4532',
      tags: ['배드민턴 전용']
    },
    {
      id: 'gunsan-indoor', name: '군산실내배드민턴장', area: '군산시', region: '전라',
      addr: '전북특별자치도 군산시 남수송5길 39', lat: 35.96251, lng: 126.70882,
      courts: null, hours: '', fee: '', tel: '063-454-5726',
      tags: ['배드민턴 전용']
    },
    {
      id: 'mokpo', name: '목포배드민턴센터', area: '목포시', region: '전라',
      addr: '전남광주통합특별시 목포시 영산로 714', lat: 34.82911, lng: 126.42063,
      courts: null, hours: '', fee: '', tel: '061-285-9877',
      tags: ['배드민턴 전용']
    },
    {
      id: 'suncheon-palma', name: '팔마실내체육관', area: '순천시', region: '전라',
      addr: '전남광주통합특별시 순천시 팔마로 333', lat: 34.93619, lng: 127.51987,
      courts: null, hours: '', fee: '', tel: '061-749-8501',
      tags: ['실내체육관']
    },
    {
      id: 'yeosu-jinnam', name: '진남배드민턴장', area: '여수시', region: '전라',
      addr: '전남광주통합특별시 여수시 오림동 43-1', lat: 34.75979, lng: 127.7267,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'naju', name: '나주국민체육센터', area: '나주시', region: '전라',
      addr: '전남광주통합특별시 나주시 영산강변로 99', lat: 35.01109, lng: 126.71774,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['국민체육센터']
    },
    {
      id: 'busan-sajik', name: '부산사직종합운동장 실내체육관', area: '부산 동래구', region: '경상',
      addr: '부산 동래구 사직로 55-32', lat: 35.19242, lng: 129.06072,
      courts: null, hours: '', fee: '', tel: '051-500-2253',
      tags: ['실내체육관']
    },
    {
      id: 'busan-sasang', name: '사상구국민체육센터', area: '부산 사상구', region: '경상',
      addr: '부산 사상구 가야대로196번길 51', lat: 35.1475, lng: 128.99463,
      courts: null, hours: '', fee: '', tel: '051-319-7330',
      tags: ['국민체육센터']
    },
    {
      id: 'busan-seungsang', name: '상승배드민턴센터', area: '부산 사상구', region: '경상',
      addr: '부산 사상구 가야대로 235', lat: 35.15051, lng: 128.9984,
      courts: null, hours: '', fee: '', tel: '010-9968-8811',
      tags: ['배드민턴 전용']
    },
    {
      id: 'busan-buam', name: '부암배드민턴센터', area: '부산 부산진구', region: '경상',
      addr: '부산 부산진구 백양대로 36', lat: 35.16302, lng: 129.04553,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'busan-badminton', name: '부산배드민턴센터', area: '부산 강서구', region: '경상',
      addr: '부산광역시 강서구 낙동북로 41', lat: 35.21948, lng: 128.93437,
      courts: null, hours: '', fee: '', tel: '+82 51-971-9877',
      tags: ['배드민턴 전용']
    },
    {
      id: 'daegu-suseong', name: '수성국민체육센터', area: '대구 수성구', region: '경상',
      addr: '대구 수성구 동대구로50길 121-10', lat: 35.84783, lng: 128.63072,
      courts: null, hours: '', fee: '', tel: '053-666-2191',
      tags: ['국민체육센터']
    },
    {
      id: 'daegu-dalseong', name: '달성군민체육관', area: '대구 달성군', region: '경상',
      addr: '대구 달성군 현풍읍 현풍중앙로 130', lat: 35.70045, lng: 128.44133,
      courts: null, hours: '', fee: '', tel: '053-659-4100',
      tags: ['실내체육관']
    },
    {
      id: 'daegu-seongseo', name: '성서산업단지 다목적체육관', area: '대구 달서구', region: '경상',
      addr: '대구 달서구 성서공단로22길 25', lat: 35.83283, lng: 128.49545,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['다목적 체육관']
    },
    {
      id: 'ulsan-munsu', name: '문수체육관', area: '울산 남구', region: '경상',
      addr: '울산 남구 웅촌로 1342', lat: 35.53442, lng: 129.25302,
      courts: null, hours: '', fee: '', tel: '052-220-2740',
      tags: ['실내체육관']
    },
    {
      id: 'ulsan-dongcheon', name: '동천체육관', area: '울산 중구', region: '경상',
      addr: '울산 중구 염포로 85', lat: 35.56234, lng: 129.35043,
      courts: null, hours: '', fee: '', tel: '052-294-4120',
      tags: ['실내체육관']
    },
    {
      id: 'ulsan-namgu', name: '남구국민체육센터', area: '울산 남구', region: '경상',
      addr: '울산 남구 여천로 38', lat: 35.52284, lng: 129.33796,
      courts: null, hours: '', fee: '', tel: '052-226-1979',
      tags: ['국민체육센터']
    },
    {
      id: 'changwon', name: '시민생활체육관', area: '창원시 성산구', region: '경상',
      addr: '경남 창원시 성산구 원이대로 692', lat: 35.22239, lng: 128.68795,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'changwon-seongsan', name: '성산스포츠센터', area: '창원시 성산구', region: '경상',
      addr: '경남 창원시 성산구 창이대로 888', lat: 35.20621, lng: 128.70606,
      courts: null, hours: '', fee: '', tel: '055-210-8220',
      tags: ['스포츠센터']
    },
    {
      id: 'gimhae-jangyu', name: '장유스포츠센터', area: '김해시', region: '경상',
      addr: '경남 김해시 번화2로 72', lat: 35.19574, lng: 128.80495,
      courts: null, hours: '', fee: '', tel: '055-312-8445',
      tags: ['스포츠센터']
    },
    {
      id: 'yangsan', name: '양산종합운동장 실내체육관', area: '양산시', region: '경상',
      addr: '경남 양산시 양산대로 849', lat: 35.34619, lng: 129.03285,
      courts: null, hours: '', fee: '', tel: '055-379-8530',
      tags: ['실내체육관']
    },
    {
      id: 'jinju', name: '진주실내체육관', area: '진주시', region: '경상',
      addr: '경남 진주시 남강로 1655', lat: 35.20789, lng: 128.12521,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'pohang', name: '포항체육관', area: '포항시 남구', region: '경상',
      addr: '경북 포항시 남구 희망대로 810', lat: 36.00856, lng: 129.36083,
      courts: null, hours: '', fee: '', tel: '054-280-9505',
      tags: ['실내체육관']
    },
    {
      id: 'gyeongju', name: '경주실내체육관', area: '경주시', region: '경상',
      addr: '경북 경주시 황성공원로 29', lat: 35.86066, lng: 129.20906,
      courts: null, hours: '', fee: '', tel: '054-750-8554',
      tags: ['실내체육관']
    },
    {
      id: 'gumi-daон', name: '다온배드민턴센터', area: '구미시 산동읍', region: '경상',
      addr: '경북 구미시 산동읍 산호대로43길 18-22', lat: 36.13951, lng: 128.44354,
      courts: null, hours: '', fee: '', tel: '010-9857-3795',
      tags: ['배드민턴 전용']
    },
    {
      id: 'jeju-halla', name: '한라체육관', area: '제주시', region: '제주',
      addr: '제주특별자치도 제주시 서광로2길 24', lat: 33.4975, lng: 126.51545,
      courts: null, hours: '', fee: '', tel: '064-728-3271',
      tags: ['실내체육관']
    },
    {
      id: 'jeju-complex', name: '제주복합체육관', area: '제주시', region: '제주',
      addr: '제주특별자치도 제주시 서광로2길 24', lat: 33.49513, lng: 126.51885,
      courts: null, hours: '', fee: '', tel: '064-727-7330',
      tags: ['실내체육관']
    },
    {
      id: 'jeju-center', name: '제주시국민체육센터', area: '제주시', region: '제주',
      addr: '제주 제주시 사라봉동길 25', lat: 33.5146, lng: 126.54644,
      courts: null, hours: '', fee: '', tel: '+82 64-728-3922',
      tags: ['국민체육센터']
    },
    {
      id: 'sarabong', name: '사라봉다목적체육관', area: '제주시', region: '제주',
      addr: '제주특별자치도 제주시 동문로 169', lat: 33.51382, lng: 126.54569,
      courts: null, hours: '', fee: '', tel: '064-752-3391',
      tags: ['다목적 체육관']
    },
    {
      id: 'gujwa', name: '구좌체육관', area: '제주시 구좌읍', region: '제주',
      addr: '제주특별자치도 제주시 구좌읍 김녕로 209', lat: 33.55619, lng: 126.76089,
      courts: null, hours: '', fee: '', tel: '064-728-8536',
      tags: ['실내체육관']
    },
    {
      id: 'hallim', name: '한림체육관', area: '제주시 한림읍', region: '제주',
      addr: '제주특별자치도 제주시 한림읍 한림중앙로 71-9', lat: 33.40909, lng: 126.26874,
      courts: null, hours: '', fee: '', tel: '',
      tags: ['실내체육관']
    },
    {
      id: 'seogwipo', name: '서귀포국민체육센터', area: '서귀포시', region: '제주',
      addr: '제주 서귀포시 중문관광로 346', lat: 33.25107, lng: 126.43204,
      courts: null, hours: '', fee: '', tel: '+82 64-760-3645',
      tags: ['국민체육센터']
    },
    {
      id: 'mapo', name: '마포구민체육센터', area: '마포구 망원동', region: '서울',
      addr: '서울 마포구 월드컵로25길 190', lat: 37.55674, lng: 126.89692,
      courts: 12, hours: '평일 06:00–11:50 · 19:00–21:50, 주말 06:00–21:50', fee: '2시간 성인 2,500원', tel: '02-324-7800',
      tags: ['구민체육센터']
    },
    {
      id: 'magok', name: '마곡레포츠센터 실내배드민턴장', area: '강서구 마곡동', region: '서울',
      addr: '서울 강서구 양천로 251', lat: 37.57323, lng: 126.83123,
      courts: 14, hours: '평일 06:00–22:00 · 토 06:00–18:00 · 일 09:00–17:00', fee: '프로그램별 상이', tel: '02-2063-3990',
      tags: ['배드민턴 전용']
    },
    {
      id: 'yeongdeungpo', name: '영등포다목적배드민턴체육관', area: '영등포구 신길동', region: '서울',
      addr: '서울 영등포구 도신로15길 5', lat: 37.50596, lng: 126.89815,
      courts: 12, hours: '평일 06:00–21:40 · 주말 07:00–17:30', fee: '일회 성인 3,000원', tel: '02-2630-2995',
      tags: ['배드민턴 전용']
    },
    {
      id: 'doksan', name: '독산배드민턴체육관', area: '금천구 독산동', region: '서울',
      addr: '서울 금천구 독산로54길 102-82', lat: 37.46736, lng: 126.90999,
      courts: 9, hours: '평일 06:00–22:00 · 주말 06:00–18:50', fee: '평일 3,000원 · 주말 3,900원', tel: '070-8670-1823',
      tags: ['배드민턴 전용']
    },
    {
      id: 'songpa', name: '송파배드민턴체육관', area: '송파구 거여동', region: '서울',
      addr: '서울 송파구 문정로 176', lat: 37.49373, lng: 127.13828,
      courts: 8, hours: '매일 06:00–22:00', fee: '평일 2,500원 · 주말 3,200원', tel: '02-403-2839',
      tags: ['배드민턴 전용', '송파구민']
    },
    {
      id: 'wolgye', name: '월계배드민턴장', area: '노원구 월계동', region: '서울',
      addr: '서울 노원구 마들로5가길 113 (초안산 스포츠타운)', lat: 37.63841, lng: 127.05145,
      courts: 10, hours: '화–일 06:00–22:00 (월 휴장)', fee: '성인 2,000원', tel: '02-2289-6863',
      tags: ['배드민턴 전용']
    },
    {
      id: 'wolgok', name: '구립월곡배드민턴체육관', area: '성북구 월곡동', region: '서울',
      addr: '서울 성북구 월곡로', lat: 37.60832, lng: 127.04197,
      courts: null, hours: '매일 06:00–22:00', fee: '', tel: '',
      tags: ['배드민턴 전용']
    },
    {
      id: 'guksabong', name: '국사봉체육관', area: '동작구 상도동', region: '서울',
      addr: '서울 동작구 국회단지길 144', lat: 37.49156, lng: 126.94179,
      courts: null, hours: '월 06:00–12:00 · 화–일 06:00–22:00', fee: '', tel: '02-2081-2690',
      tags: ['배드민턴 전용']
    },
    {
      id: 'miseong', name: '미성체육관', area: '관악구 신림동', region: '서울',
      addr: '서울 관악구 난우16길 37', lat: 37.47775, lng: 126.9188,
      courts: null, hours: '매일 06:00–22:00', fee: '', tel: '02-2015-2765',
      tags: ['배드민턴 전용']
    },
    {
      id: 'maljuk', name: '말죽거리 배드민턴장', area: '강남구 양재동', region: '서울',
      addr: '서울 강남구 양재동', lat: 37.48249, lng: 127.03387,
      courts: null, hours: '평일 06:00–22:30 · 주말 06:00–19:00', fee: '', tel: '',
      tags: []
    },
    {
      id: 'guro', name: '구로누리 배드민턴장', area: '구로구 구로동', region: '서울',
      addr: '서울 구로구 구로동 18-10', lat: 37.5047, lng: 126.8928,
      courts: null, hours: '평일 06:00–22:00 · 토 07:00–19:00', fee: '', tel: '',
      tags: []
    },
    {
      id: 'mukdong', name: '묵동다목적체육관', area: '중랑구 묵동', region: '서울',
      addr: '서울 중랑구 숙선옹주로 66', lat: 37.61444, lng: 127.08417,
      courts: null, hours: '운영 시간은 전화 문의', fee: '', tel: '02-949-5577',
      tags: ['다목적 체육관']
    }
  ];

  /* 지도 첫 화면은 서울이 보이게, '전체 보기'는 전국을 담습니다. */
  var SEOUL_VIEW = { lat: 37.5350, lng: 126.9800, zoom: 11 };

  /* 권역 필터 칩 — 목록의 region 값과 그대로 맞춥니다.
   * '강원·제주'는 칩 하나로 묶어 7개만 두었습니다(좁은 폰 화면에서 한 줄). */
  var REGIONS = [
    { key: 'all', label: '전체', match: null },
    { key: 'seoul', label: '서울', match: ['서울'] },
    { key: 'gg', label: '경기·인천', match: ['경기·인천'] },
    { key: 'gangwon', label: '강원·제주', match: ['강원', '제주'] },
    { key: 'chungcheong', label: '충청', match: ['충청'] },
    { key: 'jeolla', label: '전라', match: ['전라'] },
    { key: 'gyeongsang', label: '경상', match: ['경상'] }
  ];

  function regionDef(key) {
    var k = String(key || 'all');
    for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].key === k) return REGIONS[i];
    return REGIONS[0];
  }

  function inRegion(v, key) {
    var def = regionDef(key);
    if (!def.match) return true;
    return def.match.indexOf(String((v || {}).region || '')) >= 0;
  }

  function clone(v) {
    return {
      id: v.id, name: v.name, area: v.area, region: v.region,
      addr: v.addr, lat: v.lat, lng: v.lng,
      courts: v.courts, hours: v.hours, fee: v.fee, tel: v.tel,
      tags: (v.tags || []).slice()
    };
  }

  function all() { return VENUES.map(clone); }

  function get(id) {
    var key = String(id == null ? '' : id);
    for (var i = 0; i < VENUES.length; i++) if (VENUES[i].id === key) return clone(VENUES[i]);
    return null;
  }

  function ids() { return VENUES.map(function (v) { return v.id; }); }

  /* ---------- 거리 (내 위치 → 체육관) ----------
   * Haversine — 위도·경도 두 점 사이의 대권 거리(km).
   * 테스트와 화면이 같은 함수를 쓰도록 여기에 둡니다. */
  var EARTH_KM = 6371.0088;

  function toRad(deg) { return (Number(deg) || 0) * Math.PI / 180; }

  function pointOf(p) {
    if (!p) return null;
    var lat = Number(p.lat), lng = Number(p.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }

  function distanceKm(from, to) {
    var a = pointOf(from), b = pointOf(to);
    if (!a || !b) return null;
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var h = Math.pow(Math.sin(dLat / 2), 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
    var km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    return Math.round(km * 10) / 10;      /* 화면·정렬 모두 0.1km 단위면 충분합니다 */
  }

  /* '약 1.2 km' — 가까운 곳은 0.1km 아래로 내려가지 않게 */
  function distLabel(km) {
    if (km === null || km === undefined || km === '') return '';
    var k = Number(km);
    if (!isFinite(k) || k < 0) return '';
    if (k < 0.1) k = 0.1;
    return '약 ' + k.toFixed(1) + ' km';
  }

  /* 거리 붙은 사본 — 원본 목록은 그대로 둡니다 */
  function withDistance(list, from) {
    return (list || []).map(function (v) {
      var c = clone(v);
      c.dist = distanceKm(from, v);
      return c;
    });
  }

  /* 가까운 순 (거리를 못 구한 곳은 뒤로) */
  function nearby(list, from) {
    var out = withDistance(list, from);
    out.sort(function (a, b) {
      var da = a.dist == null ? 1e9 : a.dist;
      var db = b.dist == null ? 1e9 : b.dist;
      return da - db;
    });
    return out;
  }

  /* ---------- 이름 → 체육관 찾기 ----------
   * 프로필·모집글에는 '나래울'처럼 짧게 적힌 이름도 있어, 띄어쓰기·일반 접미사
   * (체육관·배드민턴장 등)를 떼고 비교합니다. 여러 곳에 똑같이 걸리면 고르지 않습니다. */
  var GENERIC = ['실내배드민턴장', '배드민턴체육관', '다목적체육관', '구민체육센터', '배드민턴장', '체육센터', '체육관'];

  function normName(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\s()\[\]{}·.,'"`~\-]/g, '');
  }

  function coreName(s) {
    var n = normName(s);
    GENERIC.forEach(function (g) { n = n.split(g).join(''); });
    return n;
  }

  function matchVenue(name) {
    var q = normName(name);
    if (q.length < 2) return null;                 /* '체', '' 같은 값은 고르지 않음 */
    var qCore = coreName(name);
    var best = null, bestScore = 0, ties = 0;
    VENUES.forEach(function (v) {
      var n = normName(v.name), c = coreName(v.name);
      var score = 0;
      if (q === n) score = 100;                    /* 이름 그대로 */
      else if (n.indexOf(q) === 0) score = 90;     /* '나래울' → '나래울 배드민턴장' */
      else if (n.indexOf(q) >= 0) score = 85;
      else if (q.indexOf(n) >= 0) score = 82;      /* '마포구민체육센터 1층' → 이름 포함 */
      else if (qCore.length >= 2 && c && qCore === c) score = 80;
      else if (qCore.length >= 2 && c && c.indexOf(qCore) === 0) score = 70;
      else if (qCore.length >= 2 && c && qCore.indexOf(c) >= 0) score = 68;
      else if (q.length >= 2 && normName(v.area).indexOf(q) >= 0) score = 40;   /* 동네 이름만 */
      if (score > bestScore) { best = v; bestScore = score; ties = 1; }
      else if (score > 0 && score === bestScore) ties++;
    });
    if (!best || ties > 1) return null;            /* '체육관'처럼 여럿에 걸리면 고르지 않음 */
    return clone(best);
  }

  /* ---------- 즐겨찾기 (이 기기 · 계정별) ---------- */
  function keyFor(scope) {
    return KEY + '::' + String(scope || 'guest').toLowerCase();
  }

  function readFavs(scope) {
    var raw = U.readJSON(keyFor(scope), []);
    if (!Array.isArray(raw)) return [];
    var seen = {};
    return raw.map(function (v) { return String(v == null ? '' : v); })
      .filter(function (v) {
        if (!v || seen[v] || !get(v)) return false;   /* 없는 체육관·중복은 버립니다 */
        seen[v] = true;
        return true;
      });
  }

  function saveFavs(scope, list) {
    var clean = [];
    (list || []).forEach(function (v) {
      var id = String(v == null ? '' : v);
      if (id && clean.indexOf(id) < 0 && get(id)) clean.push(id);
    });
    U.writeJSON(keyFor(scope), clean);
    return clean;
  }

  function favorites(scope) { return readFavs(scope); }

  function isFav(scope, id) { return readFavs(scope).indexOf(String(id)) >= 0; }

  /* 별을 눌렀을 때: 없으면 맨 앞에 추가, 있으면 해제 */
  function toggle(scope, id) {
    var key = String(id == null ? '' : id);
    if (!get(key)) return { ok: false, added: false, favorites: readFavs(scope) };
    var list = readFavs(scope);
    var at = list.indexOf(key);
    var added = at < 0;
    if (added) list.unshift(key);
    else list.splice(at, 1);
    return { ok: true, added: added, favorites: saveFavs(scope, list) };
  }

  function clear(scope) {
    U.storage.removeItem(keyFor(scope));
    return [];
  }

  /* ---------- 목록 고르기 (순수 함수 — 화면·테스트가 같이 씁니다) ---------- */
  /* opts: { onlyFav, favorites, query, region } */
  function filter(list, opts) {
    opts = opts || {};
    var favs = opts.favorites || [];
    var q = String(opts.query || '').replace(/\s+/g, '').toLowerCase();
    return (list || []).filter(function (v) {
      if (opts.onlyFav && favs.indexOf(v.id) < 0) return false;
      if (!inRegion(v, opts.region)) return false;
      if (!q) return true;
      var hay = [v.name, v.area, v.region, v.dong, v.addr].join('').replace(/\s+/g, '').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  /* 권역별 체육관 수 — 필터 칩 옆 숫자 */
  function regionCounts(list) {
    var out = {};
    (list || VENUES).forEach(function (v) {
      REGIONS.forEach(function (def) {
        if (!def.match) { out[def.key] = (out[def.key] || 0) + 1; return; }
        if (def.match.indexOf(String(v.region || '')) >= 0) out[def.key] = (out[def.key] || 0) + 1;
      });
    });
    return out;
  }

  /* 즐겨찾기를 목록 맨 앞으로 (즐겨찾기끼리는 담은 순서, 나머지는 원래 순서) */
  function withFavoritesFirst(list, favs) {
    favs = favs || [];
    var mines = [], rest = [];
    (list || []).forEach(function (v) {
      if (favs.indexOf(v.id) >= 0) mines.push(v);
      else rest.push(v);
    });
    mines.sort(function (a, b) { return favs.indexOf(a.id) - favs.indexOf(b.id); });
    return mines.concat(rest);
  }

  /* ---------- 지도 좌표 → 상자 안 위치(%) ----------
   * Leaflet 을 못 불러왔을 때(오프라인·CDN 차단)에도 핀이 제자리에 찍히도록
   * 단순 등장방형 투영으로 0~100% 위치를 계산합니다. */
  function project(list, pad) {
    var box = { latMin: 90, latMax: -90, lngMin: 180, lngMax: -180 };
    (list || []).forEach(function (v) {
      if (v.lat < box.latMin) box.latMin = v.lat;
      if (v.lat > box.latMax) box.latMax = v.lat;
      if (v.lng < box.lngMin) box.lngMin = v.lng;
      if (v.lng > box.lngMax) box.lngMax = v.lng;
    });
    var p = (pad == null ? 8 : Math.max(0, Number(pad) || 0));
    var span = 100 - p * 2;
    var dLat = box.latMax - box.latMin || 1;
    var dLng = box.lngMax - box.lngMin || 1;
    return (list || []).map(function (v) {
      return {
        id: v.id, name: v.name,
        x: Math.round((p + ((v.lng - box.lngMin) / dLng) * span) * 100) / 100,
        y: Math.round((p + ((box.latMax - v.lat) / dLat) * span) * 100) / 100
      };
    });
  }

  /* 서울 시내 체육관만 (지도 첫 화면) — 나래울(동탄)은 '전체 보기'에서 */
  var SEOUL_BOX = { latMin: 37.42, latMax: 37.70, lngMin: 126.75, lngMax: 127.20 };
  function inSeoul(v) {
    return v.lat >= SEOUL_BOX.latMin && v.lat <= SEOUL_BOX.latMax &&
      v.lng >= SEOUL_BOX.lngMin && v.lng <= SEOUL_BOX.lngMax;
  }
  function seoulOnly(list) { return (list || []).filter(inSeoul); }

  BM.gyms = {
    KEY: KEY, VENUES: VENUES, SEOUL_VIEW: SEOUL_VIEW, SEOUL_BOX: SEOUL_BOX, EARTH_KM: EARTH_KM,
    REGIONS: REGIONS, regionDef: regionDef, inRegion: inRegion, regionCounts: regionCounts,
    all: all, get: get, ids: ids, keyFor: keyFor, inSeoul: inSeoul, seoulOnly: seoulOnly,
    favorites: favorites, isFav: isFav, toggle: toggle, clear: clear, saveFavs: saveFavs,
    filter: filter, withFavoritesFirst: withFavoritesFirst, project: project,
    pointOf: pointOf, distanceKm: distanceKm, distLabel: distLabel,
    withDistance: withDistance, nearby: nearby, matchVenue: matchVenue,
    count: function () { return VENUES.length; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
