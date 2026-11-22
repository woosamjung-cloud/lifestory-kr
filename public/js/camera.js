// 장면 공통 카메라 규칙 (정동진을 기준으로 맞춘 값, 모든 스테이지에 똑같이 적용)
// 특정 장소만 다르게 하려면 sun.js PLACES의 그 장소에 camera: { seated: { leadMax: 0.03 } } 처럼 바꿀 값만 적으면 됩니다.
export const CAMERA = {
  // 넓은 해변(월드) 폭 = 화면 폭 × 배수
  world: { phone: 2, landscape: 1.5, wide: 1.3 }, // wide: 화면 폭 900px 이상(PC)
  // 휴대폰 기울기 인식
  tilt: { deadzone: 4, range: 22 }, // 4도까지는 무시, 26도에서 최대
  // 걷거나 서 있을 때
  standing: {
    leadMax: 0.18, // 기울이면 그쪽을 화면 폭의 18%까지 더 보여 줌
    keepIn: [0.18, 0.82], // 내 캐릭터는 화면의 18%~82% 안에 꼭 남음
    followBand: [0.25, 0.75], // 걸어서 이 범위를 벗어나면 카메라가 따라감
  },
  // 앉아 있을 때
  seated: {
    leadMax: 0.06, // 좌우로는 화면 폭의 6%까지만 살짝
    tiltYMax: 9, // 앞뒤로 기울이면 장면 전체가 위아래로 최대 9px
    returnAfterMs: 6000, // 손으로 끌어 구경한 뒤 가만히 있으면 이 시간 뒤 내 자리로
  },
  // 먼 하늘·바다·섬은 해변보다 천천히 (해변 이동량의 12%)
  farParallax: 0.12,
};

// 장소별로 바꾼 값을 기본 규칙 위에 덮어씀
export function cameraFor(place) {
  const o = (place && place.camera) || {};
  return {
    world: { ...CAMERA.world, ...o.world },
    tilt: { ...CAMERA.tilt, ...o.tilt },
    standing: { ...CAMERA.standing, ...o.standing },
    seated: { ...CAMERA.seated, ...o.seated },
    farParallax: o.farParallax ?? CAMERA.farParallax,
  };
}
