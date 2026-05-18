import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '../../src/lib/auth'
import { prisma } from '@/lib/prisma'
import CancelSubscriptionButton from './CancelSubscriptionButton'
import DeleteParentButton from './DeleteParentButton'
import LogoutButton from './LogoutButton'
import PushInit from '../components/PushInit'
import StartTrialButton from './StartTrialButton'
import RefreshButton from './RefreshButton'

const FOLLOW_UP_AFTER_HOURS = 2
const GUARDIAN_ALERT_AFTER_HOURS = 3

type TodayResponse = {
  responded: boolean
  respondedAt: Date | null
  message: string | null
  date: Date
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('ko-KR')
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleString('ko-KR')
}

function formatPhone(phone: string) {
  return phone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, '$1-****-$3')
}

function getTodayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getPlanLabel(plan: string | null | undefined) {
  if (plan?.toLowerCase() === 'yearly') return '연간 구독'
  if (plan?.toLowerCase() === 'monthly') return '월간 구독'
  return '구독'
}

function getProviderLabel(provider: string | null | undefined) {
  if (provider === 'KAKAO_PAY') return '카카오페이'
  if (provider === 'TOSS') return '토스페이먼츠'
  if (provider === 'TRIAL') return '무료 체험'
  return '결제수단'
}

function getStatusLabel(status: string | null | undefined) {
  if (status === 'active') return '활성'
  if (status === 'trial') return '무료 체험 중'
  if (status === 'failed') return '결제 실패'
  if (status === 'canceled') return '해지'
  if (status === 'pending') return '결제 대기'
  return '알 수 없음'
}

function getStatusClass(status: string | null | undefined) {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'trial') return 'bg-blue-100 text-blue-700'
  if (status === 'failed') return 'bg-red-100 text-red-700'
  if (status === 'canceled') return 'bg-gray-100 text-gray-600'
  return 'bg-yellow-100 text-yellow-700'
}

function getReplyDeadline(response: TodayResponse | null | undefined) {
  if (!response) return null
  return new Date(
    new Date(response.date).getTime() + GUARDIAN_ALERT_AFTER_HOURS * 60 * 60 * 1000
  )
}

function getReplyStatus(response: TodayResponse | null | undefined) {
  const now = new Date()
  if (!response) {
    return {
      label: '대기중',
      className: 'bg-gray-100 text-gray-600',
      description: '오늘 아침 안부 기록이 아직 없습니다.',
    }
  }
  const deadline = getReplyDeadline(response)
  if (response.responded) {
    const respondedAt = response.respondedAt ? new Date(response.respondedAt) : null
    if (deadline && respondedAt && respondedAt.getTime() > deadline.getTime()) {
      return {
        label: '늦은 응답',
        className: 'bg-orange-100 text-orange-700',
        description: '2시간 이후 응답했습니다.',
      }
    }
    return {
      label: '응답 완료',
      className: 'bg-green-100 text-green-700',
      description: '2시간 내에 응답했습니다.',
    }
  }
  if (deadline && now.getTime() > deadline.getTime()) {
    return {
      label: '보호자 알림 필요',
      className: 'bg-red-100 text-red-700',
      description: '안부 생성 후 2시간 넘게 응답이 없습니다.',
    }
  }
  return {
    label: '대기중',
    className: 'bg-yellow-100 text-yellow-700',
    description: '아직 응답을 기다리는 중입니다.',
  }
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const kakaoId = (session.user as { id?: string })?.id
  const { start, end } = getTodayRange()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: `kakao_${kakaoId}@gyeote.com` },
        { email: session.user?.email ?? '' },
      ],
    },
    include: {
      parents: {
        include: {
          responses: {
            where: {
              type: 'morning',
              date: { gte: start, lte: end },
            },
            orderBy: { date: 'desc' },
            take: 1,
          },
          reports: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      subscriptions: true,
    },
  })

  const parents = user?.parents ?? []

  const subscriptions = [...(user?.subscriptions ?? [])].sort((a, b) => {
    const aDate = a.updatedAt ?? a.lastPaidAt ?? a.nextBillingAt ?? a.createdAt
    const bDate = b.updatedAt ?? b.lastPaidAt ?? b.nextBillingAt ?? b.createdAt
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })

  const activeSubscription = subscriptions.find(
    (s) => s.status === 'active' || s.status === 'trial'
  )
  const failedSubscription = subscriptions.find((s) => s.status === 'failed')
  const latestSubscription = subscriptions[0]

  const isTrial = activeSubscription?.status === 'trial'
  const trialDaysLeft = isTrial && activeSubscription?.nextBillingAt
    ? Math.max(0, Math.ceil((new Date(activeSubscription.nextBillingAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <main className="min-h-screen bg-gray-50">
      <PushInit />
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-green-600">곁에</Link>
        <div className="flex items-center gap-3">
          <Link href="/payment" className="bg-yellow-400 text-gray-800 px-4 py-2 rounded-full text-sm font-bold">
            {activeSubscription?.status === 'active' ? '구독 관리' : '구독하기'}
          </Link>
          <span className="text-sm text-gray-500">{session.user?.name ?? '사용자'}님</span>
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-600">
            {session.user?.name?.[0] ?? 'U'}
          </div>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-3">
            <a href="http://pf.kakao.com/_tYbKX/chat" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
              의견 보내기
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {isTrial && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-800">🎉 무료 체험 중 — {trialDaysLeft}일 남았어요</p>
              <p className="text-xs text-blue-600 mt-1">체험 기간이 끝나기 전에 구독하면 계속 이용할 수 있어요.</p>
            </div>
            <Link href="/payment" className="shrink-0 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold text-center">
              지금 구독하기
            </Link>
          </div>
        )}

        <section className="mb-6">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">구독 관리</h2>
              <p className="text-sm text-gray-500 mt-1">활성 구독, 결제 실패, 해지된 구독을 최신순으로 확인합니다.</p>
            </div>
            <Link href="/payment" className="shrink-0 bg-yellow-400 text-gray-800 px-4 py-2 rounded-xl text-sm font-bold">
              결제 페이지로 이동
            </Link>
          </div>

          {activeSubscription && (
            <div className={`border rounded-2xl p-5 mb-4 ${isTrial ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ${isTrial ? 'bg-blue-500' : 'bg-green-500'}`}>
                    {isTrial ? '✦' : '✓'}
                  </span>
                  <p className="text-base font-bold text-gray-900">{isTrial ? '무료 체험 중' : '활성 구독'}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusClass(activeSubscription.status)}`}>
                    {getStatusLabel(activeSubscription.status)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className={`text-xs ${isTrial ? 'text-blue-700/70' : 'text-green-700/70'}`}>플랜</p>
                    <p className="font-bold text-gray-900 mt-1">{getPlanLabel(activeSubscription.plan)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${isTrial ? 'text-blue-700/70' : 'text-green-700/70'}`}>결제 수단</p>
                    <p className="font-bold text-gray-900 mt-1">{getProviderLabel(activeSubscription.provider)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${isTrial ? 'text-blue-700/70' : 'text-green-700/70'}`}>금액</p>
                    <p className="font-bold text-gray-900 mt-1">
                      {isTrial ? '무료' : `${activeSubscription.price.toLocaleString('ko-KR')}원`}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isTrial ? 'text-blue-700/70' : 'text-green-700/70'}`}>
                      {isTrial ? '체험 만료일' : '다음 결제 예정일'}
                    </p>
                    <p className="font-bold text-gray-900 mt-1">{formatDate(activeSubscription.nextBillingAt)}</p>
                  </div>
                </div>
                {!isTrial && (
                  <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
                    <CancelSubscriptionButton />
                  </div>
                )}
              </div>
            </div>
          )}

          {failedSubscription && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">!</span>
                    <p className="text-base font-bold text-red-700">결제 실패</p>
                  </div>
                  <p className="text-sm text-red-700 mb-4">마지막 자동 결제가 실패했습니다. 결제 수단을 확인해주세요.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-red-700/70">플랜</p>
                      <p className="font-bold text-gray-900 mt-1">{getPlanLabel(failedSubscription.plan)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-700/70">결제 수단</p>
                      <p className="font-bold text-gray-900 mt-1">{getProviderLabel(failedSubscription.provider)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-700/70">금액</p>
                      <p className="font-bold text-gray-900 mt-1">{failedSubscription.price.toLocaleString('ko-KR')}원</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-700/70">실패 확인일</p>
                      <p className="font-bold text-gray-900 mt-1">{formatDateTime(failedSubscription.updatedAt)}</p>
                    </div>
                  </div>
                </div>
                <Link href="/payment" className="shrink-0 bg-red-500 text-white px-5 py-3 rounded-xl text-sm font-bold text-center">
                  다시 결제하기
                </Link>
              </div>
            </div>
          )}

          {!activeSubscription && !failedSubscription && latestSubscription?.status !== 'canceled' && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-800">아직 구독이 활성화되지 않았습니다.</p>
                <p className="text-xs text-gray-500 mt-1">월 4,900원 또는 연 50,000원으로 부모님 안부 확인을 시작하세요.</p>
              </div>
              <Link href="/payment" className="shrink-0 bg-yellow-400 text-gray-800 px-4 py-2 rounded-xl text-sm font-bold text-center">
                결제하기
              </Link>
            </div>
          )}

          {subscriptions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-base font-bold text-gray-900 mb-4">구독 이력</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2 pr-4">플랜</th>
                      <th className="py-2 pr-4">결제 수단</th>
                      <th className="py-2 pr-4">금액</th>
                      <th className="py-2 pr-4">다음 결제일</th>
                      <th className="py-2 pr-4">수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id} className="border-b last:border-b-0">
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusClass(subscription.status)}`}>
                            {getStatusLabel(subscription.status)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-800">{getPlanLabel(subscription.plan)}</td>
                        <td className="py-3 pr-4 text-gray-800">{getProviderLabel(subscription.provider)}</td>
                        <td className="py-3 pr-4 text-gray-800">
                          {subscription.status === 'trial' ? '무료' : `${subscription.price.toLocaleString('ko-KR')}원`}
                        </td>
                        <td className="py-3 pr-4 text-gray-800">{formatDate(subscription.nextBillingAt)}</td>
                        <td className="py-3 pr-4 text-gray-500">{formatDate(subscription.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6">
          {parents.length === 0 ? (
            <>
              {!activeSubscription && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                  <p className="text-sm font-bold text-blue-800">🎉 무료 체험 7일 가능</p>
                  <p className="text-xs text-blue-600 mt-1">부모님을 등록하면 초대 코드로 7일 무료 체험을 시작할 수 있어요.</p>
                </div>
              )}
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-5xl mb-4">👨‍👩‍👧</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">부모님을 등록해주세요</h2>
                <p className="text-gray-500 text-sm mb-6">부모님 전화번호와 안부 확인 시간을 등록하면 매일 자동으로 안부 확인을 시작합니다.</p>
                <Link href="/onboard" className="bg-green-500 text-white px-6 py-3 rounded-xl font-medium inline-block">
                  부모님 등록하기
                </Link>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">등록된 부모님</h2>
                  <p className="text-xs text-gray-400 mt-0.5">최대 2명까지 등록 가능합니다.</p>
                </div>
                {parents.length < 2 && (
                  <Link href="/onboard" className="text-sm text-green-600 font-medium">
                    + 추가 ({parents.length}/2)
                  </Link>
                )}
              </div>

              {!activeSubscription && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-blue-800">🎉 7일 무료 체험을 시작해보세요</p>
                    <p className="text-xs text-blue-600 mt-1">카드 없이 7일간 무료로 서비스를 이용할 수 있어요.</p>
                  </div>
                  <StartTrialButton />
                </div>
              )}

              {parents.map((parent) => {
                const todayResponse = parent.responses[0]
                const replyStatus = getReplyStatus(todayResponse)
                const replyDeadline = getReplyDeadline(todayResponse)
                const latestReport = parent.reports[0]

                return (
                  <div key={parent.id} className="bg-white rounded-xl p-4 shadow-sm mb-3">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">👨‍👩‍👧</div>
                      <div className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <div className="font-medium text-gray-800">{parent.name}</div>
                            <div className="text-sm text-gray-500">{formatPhone(parent.phone)} · 아침 {parent.morningTime}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`w-fit px-3 py-1 rounded-full text-xs font-bold ${replyStatus.className}`}>
                              {replyStatus.label}
                            </span>
                            <RefreshButton />
                            <DeleteParentButton parentId={parent.id} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{replyStatus.description}</p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">오늘 답장</p>
                            <p className="font-medium text-gray-800 mt-1">{todayResponse?.message ?? '-'}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">답장 시간</p>
                            <p className="font-medium text-gray-800 mt-1">{formatDateTime(todayResponse?.respondedAt)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">안부 생성일</p>
                            <p className="font-medium text-gray-800 mt-1">{formatDateTime(todayResponse?.date)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">보호자 알림 기준</p>
                            <p className="font-medium text-gray-800 mt-1">{formatDateTime(replyDeadline)}</p>
                          </div>
                        </div>

                        {latestReport && (
                          <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-4">
                            <p className="text-xs text-green-700 font-bold mb-2">
                              📋 주간 리포트 — {formatDate(latestReport.createdAt)}
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                              {latestReport.content}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}