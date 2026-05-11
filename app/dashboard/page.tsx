import { getServerSession } from 'next-auth'
import { authOptions } from '../../src/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '../../src/lib/prisma'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const kakaoId = (session?.user as any)?.id
  const user = await prisma.user.findUnique({
    where: { email: `kakao_${kakaoId}@gyeote.com` },
    include: { parents: true },
  })
  const parents = user?.parents ?? []

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
        {parents.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm mb-6">
            <div className="text-5xl mb-4">👴</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">부모님을 등록해보세요</h2>
            <p className="text-gray-500 text-sm mb-6">부모님 전화번호를 등록하면 매일 아침 카카오로 안부를 드려요.</p>
            <a href="/onboard" className="bg-green-500 text-white px-6 py-3 rounded-xl font-medium inline-block">부모님 등록하기</a>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">등록된 부모님</h2>
              <a href="/onboard" className="text-sm text-green-600 font-medium">+ 추가</a>
            </div>
            {parents.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex items-center gap-4">
                <div className="text-3xl">👴</div>
                <div>
                  <div className="font-medium text-gray-800">{p.name}</div>
                  <div className="text-sm text-gray-500">{p.phone} · 아침 {p.morningTime}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}