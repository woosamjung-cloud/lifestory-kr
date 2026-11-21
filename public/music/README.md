# 배경 음악 넣는 곳

이 폴더에 MP3 파일과 `tracks.json`을 넣으면, 사이트의 🎵 음악 버튼이 그 곡을 시간대에 맞춰 재생합니다.
`tracks.json`이 없으면 브라우저에서 직접 만드는 잔잔한 연주가 나옵니다.

```json
{ "sunrise": ["sunrise1.mp3"], "sunset": ["sunset1.mp3"], "night": ["night1.mp3"] }
```

- 가사 없는 잔잔한 연주곡, 곡당 3~4분, 128kbps MP3 권장
- 상업적 이용이 허락된 곡만 (수노 AI는 유료 플랜으로 만든 곡)
