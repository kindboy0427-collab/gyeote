import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-bold text-green-600">곁에</h1>
        <Link href="/login" className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
          시작하기
        </Link>
      </header>

      <section className="flex flex-col items-center justify-center text-center px-6 py-28 bg-gradient-to-b from-white to-green-50">
        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-6">
          매일 아침 카카오톡으로 자동 안부 확인
        </span>
        <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-5 leading-tight">
          부모님 걱정,<br />곁에가 대신 챙겨드려요
        </h2>
        <p className="text-lg text-gray-500 mb-10 max-w-md leading-relaxed">
          매일 아침 카카오톡으로 안부를 묻고<br />
          응답이 없으면 자녀에게 즉시 알려드려요.
        </p>
        <Link
          href="/login"
          className="bg-yellow-400 text-gray-800 font-bold px-10 py-4 rounded-full text-lg shadow-md hover:bg-yellow-300 transition-colors"
        >
          카카오로 시작하기
        </Link>
        <p className="text-sm text-gray-400 mt-4">월 4,900원 · 언제든 해지 가능</p>
      </section>

      <section className="px-6 py-16 bg-gray-50">
        <h3 className="text-center text-2xl font-bold text-gray-800 mb-10">이런 분들께 딱 맞아요</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { emoji: '💬', title: '매일 아침 안부', desc: '카카오톡으로 자연스럽게 안부를 묻고 대화해요. 부모님이 익숙한 채널 그대로 사용해요.' },
            { emoji: '📊', title: '주간·월간 리포트', desc: 'AI가 한 주 대화를 분석해서 자녀에게 리포트로 전달해요. 멀리 있어도 안심돼요.' },
            { emoji: '🚨', title: '이상 감지 알림', desc: '2시간 안에 응답이 없으면 자녀에게 즉시 푸시 알림을 보내드려요.' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{f.emoji}</div>
              <h4 className="font-bold text-gray-800 mb-2 text-lg">{f.title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 bg-white">
        <h3 className="text-center text-2xl font-bold text-gray-800 mb-12">시작하기까지 3분이면 충분해요</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 max-w-3xl mx-auto">
          {[
            { step: '01', title: '카카오로 로그인', desc: '카카오 계정으로 간편하게 가입해요' },
            { step: '02', title: '부모님 정보 등록', desc: '이름과 전화번호만 입력하면 돼요' },
            { step: '03', title: '매일 자동으로 안부 확인', desc: '등록 즉시 다음날 아침부터 시작돼요' },
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                {s.step}
              </div>
              <h4 className="font-bold text-gray-800 mb-2">{s.title}</h4>
              <p className="text-gray-500 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 bg-green-500 text-center">
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
          오늘부터 부모님 곁에 있어드리세요
        </h3>
        <p className="text-green-100 mb-8 text-sm">첫 달 무료 체험 · 언제든 해지 가능</p>
        <Link
          href="/login"
          className="bg-white text-green-600 font-bold px-10 py-4 rounded-full text-lg shadow hover:bg-green-50 transition-colors inline-block"
        >
          지금 무료로 시작하기
        </Link>
      </section>

      <footer className="text-center py-6 text-xs text-gray-400 border-t">
        <p>© 2026 에브리홈 | 사업자등록번호: 592-28-02229</p>
        <p className="mt-1">곁에(gyeote) 서비스는 에브리홈이 운영합니다.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/terms" className="hover:text-gray-600">이용약관</a>
          <a href="/privacy" className="hover:text-gray-600">개인정보처리방침</a>
        </div>
      </footer>
    </main>
  )
}