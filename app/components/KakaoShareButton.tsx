'use client'

export default function KakaoShareButton() {
  const handleShare = () => {
    const url = 'https://gyeote-eight.vercel.app'
    const text = '부모님 안부를 매일 카카오톡으로 확인해드려요. 월 4,900원 곁에 서비스 추천해요!'
    window.open(
      `https://sharer.kakao.com/talk/friends/picker/easylink?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank'
    )
  }

  return (
    <button
      onClick={handleShare}
      className="mt-4 text-white underline text-sm opacity-80 hover:opacity-100"
    >
      카카오톡으로 공유하기
    </button>
  )
}