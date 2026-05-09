import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-bold text-green-600">곁에</h1>
        <Link href="/login" className="bg-green-500 text-white px-4 py-2 rounded-full text-sm">
          시작하기
        </Link>
      </header>

      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <h2 className="text-4xl font-bold text-gray-800 mb-4">
          부모님의 매일 아침 친구
        </h2>
        <p className="text-lg text-gray-500 mb-8 max-w-md">
          카카오톡으로 매일 안부를 묻고, 자녀에게는 주간 리포트로 전달해요.
        </p>
        <Link href="/login" className="bg-yellow-400 text-gray-800 font-bold px-8 py-4 rounded-full text-lg">
          카카오로 시작하기
        </Link>
        <p className="text-sm text-gray-400 mt-4">월 5,900원 · 언제든 해지 가능</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-12 bg-gray-50">
        {[
          { emoji: '💬', title: '매일 아침 안부', desc: '카카오톡으로 자연스럽게 안부를 묻고 대화해요' },
          { emoji: '📊', title: '주간·월간 리포트', desc: 'AI가 한 주를 분석해서 자녀에게 전달해요' },
          { emoji: '🚨', title: '이상 감지 알림', desc: '응답이 없으면 즉시 알림' },
        ].map((f, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-4xl mb-3">{f.emoji}</div>
            <h3 className="font-bold text-gray-800 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}