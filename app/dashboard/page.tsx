import { getServerSession } from 'next-auth'
import { authOptions } from '../../src/lib/auth'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-600">곁에</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{session.user?.name ?? '사용자'}님</span>
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600">
            {session.user?.name?.[0] ?? 'U'}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm mb-6">
          <div className="text-5xl mb-4">👴</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">부모님을 등록해보세요</h2>
          <p className="text-gray-500 text-sm mb-6">
            부모님 전화번호를 등록하면 매일 아침 카카오로 안부를 드려요.
          </p>
          <a href="/onboard" className="bg-green-500 text-white px-6 py-3 rounded-xl font-medium inline-block">
            부모님 등록하기
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {[
            { emoji: '💬', title: '매일 아침 안부', desc: '오전 9시 카카오톡으로 안부 메시지 발송' },
            { emoji: '🍚', title: '식사 확인', desc: '점심 식사 여부 확인 메시지 발송' },
            { emoji: '💊', title: '복약 알림', desc: '설정한 시간에 복약 알림 발송' },
            { emoji: '📊', title: '주간·월간 리포트', desc: 'AI가 분석한 리포트를 매주 전달' },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="text-3xl">{f.emoji}</div>
              <div>
                <div className="font-medium text-gray-800">{f.title}</div>
                <div className="text-sm text-gray-500">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}