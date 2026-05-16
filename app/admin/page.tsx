import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/src/lib/auth'
import { prisma } from '@/lib/prisma'

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleString('ko-KR')
}

function formatPrice(price: number) {
  return price.toLocaleString('ko-KR')
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userEmail = session.user?.email ?? ''
  const adminEmail = process.env.ADMIN_EMAIL

  if (userEmail !== adminEmail) {
    redirect('/dashboard')
  }

  const [
    totalUsers,
    activeSubscriptions,
    trialSubscriptions,
    canceledSubscriptions,
    recentPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.count({ where: { status: 'trial' } }),
    prisma.subscription.count({ where: { status: 'canceled' } }),
    prisma.subscription.findMany({
      where: { status: { in: ['active', 'trial', 'failed', 'canceled'] } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { user: true },
    }),
  ])

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-green-600">곁에</Link>
          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-1 rounded-full">관리자</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">총 가입자</p>
            <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
            <p className="text-xs text-gray-400 mt-1">명</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">활성 구독</p>
            <p className="text-3xl font-bold text-green-600">{activeSubscriptions}</p>
            <p className="text-xs text-gray-400 mt-1">명</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">무료 체험</p>
            <p className="text-3xl font-bold text-blue-600">{trialSubscriptions}</p>
            <p className="text-xs text-gray-400 mt-1">명</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">해지</p>
            <p className="text-3xl font-bold text-gray-400">{canceledSubscriptions}</p>
            <p className="text-xs text-gray-400 mt-1">명</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">최근 결제 내역</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="py-2 pr-4">유저</th>
                  <th className="py-2 pr-4">상태</th>
                  <th className="py-2 pr-4">플랜</th>
                  <th className="py-2 pr-4">결제수단</th>
                  <th className="py-2 pr-4">금액</th>
                  <th className="py-2 pr-4">다음 결제일</th>
                  <th className="py-2 pr-4">수정일</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 text-gray-800">{sub.user?.name ?? '-'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        sub.status === 'active' ? 'bg-green-100 text-green-700' :
                        sub.status === 'trial' ? 'bg-blue-100 text-blue-700' :
                        sub.status === 'failed' ? 'bg-red-100 text-red-700' :
                        sub.status === 'canceled' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {sub.status === 'active' ? '활성' :
                         sub.status === 'trial' ? '체험' :
                         sub.status === 'failed' ? '실패' :
                         sub.status === 'canceled' ? '해지' : '대기'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-800">
                      {sub.plan?.toLowerCase() === 'yearly' ? '연간' : '월간'}
                    </td>
                    <td className="py-3 pr-4 text-gray-800">
                      {sub.provider === 'KAKAO_PAY' ? '카카오페이' :
                       sub.provider === 'TOSS' ? '토스' :
                       sub.provider === 'TRIAL' ? '무료체험' : '-'}
                    </td>
                    <td className="py-3 pr-4 text-gray-800">
                      {sub.status === 'trial' ? '무료' : `${formatPrice(sub.price)}원`}
                    </td>
                    <td className="py-3 pr-4 text-gray-800">{formatDate(sub.nextBillingAt)}</td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(sub.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
