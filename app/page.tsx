import Link from 'next/link'
import KakaoShareButton from './components/KakaoShareButton'

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: '#fdf9f5' }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '0.5px solid #e8ddd4', background: '#fdf9f5' }}>
        <h1 className="text-xl font-bold" style={{ color: '#5c8a4a' }}>곁에</h1>
        <Link href="/login" className="text-white text-sm font-semibold px-4 py-2 rounded-full" style={{ background: '#5c8a4a' }}>
          시작하기
        </Link>
      </header>

      {/* 히어로 */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-28" style={{ background: 'linear-gradient(to bottom, #fdf9f5, #f5ede4)' }}>
        <span className="text-xs font-bold px-3 py-1 rounded-full mb-6" style={{ background: '#e8f0e2', color: '#3d6632' }}>
          7일 무료 · 카드 불필요
        </span>
        <h2 className="text-4xl md:text-5xl font-bold mb-5 leading-tight" style={{ color: '#2d2417' }}>
          바쁜 나 대신,<br />
          <span style={{ color: '#5c8a4a' }}>매일 부모님께</span><br />
          안부를 전합니다
        </h2>
        <p className="text-lg mb-2 max-w-md leading-relaxed" style={{ color: '#7a6454' }}>
          전화 한 통이 쉽지 않은 날,<br />
          곁에가 대신 여쭤봐 드려요.
        </p>
        <p className="text-sm mb-10" style={{ color: '#a08878' }}>응답 없으면 자녀에게 즉시 알려드려요</p>
        <Link
          href="/login"
          className="font-bold px-10 py-4 rounded-full text-lg shadow-md transition-colors"
          style={{ background: '#e8a84c', color: '#2d2417' }}
        >
          카카오로 무료 시작하기
        </Link>
        <p className="text-sm mt-4" style={{ color: '#a08878' }}>
          <span className="line-through">월 5,900원</span>
          <span className="font-bold ml-2" style={{ color: '#5c8a4a' }}>월 4,900원</span>
          <span className="ml-1">· 언제든 해지 가능</span>
        </p>
      </section>

      {/* 기능 카드 */}
      <section className="px-6 py-16" style={{ background: '#f5ede4' }}>
        <h3 className="text-center text-2xl font-bold mb-10" style={{ color: '#2d2417' }}>이런 분들께 딱 맞아요</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { emoji: '💬', title: '매일 아침 안부', desc: '카카오톡으로 자연스럽게 안부를 묻고 대화해요. 부모님이 익숙한 채널 그대로 사용해요.' },
            { emoji: '📊', title: '주간 리포트', desc: 'AI가 한 주 대화를 분석해서 자녀에게 리포트로 전달해요. 멀리 있어도 안심돼요.' },
            { emoji: '🚨', title: '이상 감지 알림', desc: '2시간 안에 응답이 없으면 자녀에게 즉시 푸시 알림을 보내드려요.' },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl p-7 text-center shadow-sm" style={{ background: '#fdf9f5', border: '0.5px solid #e8ddd4' }}>
              <div className="text-4xl mb-4">{f.emoji}</div>
              <h4 className="font-bold mb-2 text-lg" style={{ color: '#2d2417' }}>{f.title}</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#7a6454' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 정부 서비스 비교 */}
      <section className="px-6 py-16" style={{ background: '#fdf9f5' }}>
        <h3 className="text-center text-2xl font-bold mb-3" style={{ color: '#2d2417' }}>정부 서비스랑 뭐가 달라요?</h3>
        <p className="text-center text-sm mb-10" style={{ color: '#a08878' }}>저소득·독거 조건 없이, 누구나 바로 시작할 수 있어요</p>
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="py-3 px-4 text-left font-medium w-1/3" style={{ color: '#a08878' }}></th>
                <th className="py-3 px-4 text-center font-medium rounded-t-xl" style={{ color: '#7a6454', background: '#f5ede4' }}>정부 서비스</th>
                <th className="py-3 px-4 text-center font-bold rounded-t-xl" style={{ color: '#3d6632', background: '#e8f0e2' }}>곁에</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '신청 자격', gov: '저소득·독거 조건 필요', us: '누구나 가능' },
                { label: '시작 방법', gov: '주민센터 방문·대기', us: '카카오로 즉시 시작' },
                { label: '가족 리포트', gov: '없음', us: '주간 리포트 제공' },
                { label: '복약 알림', gov: '없음', us: '매일 점심 알림' },
                { label: '자녀 알림', gov: '없음', us: '미응답 즉시 알림' },
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '0.5px solid #e8ddd4' }}>
                  <td className="py-4 px-4 font-medium" style={{ color: '#2d2417' }}>{row.label}</td>
                  <td className="py-4 px-4 text-center" style={{ color: '#a08878', background: '#faf6f2' }}>{row.gov}</td>
                  <td className="py-4 px-4 text-center font-semibold" style={{ color: '#5c8a4a', background: '#f3f8ef' }}>{row.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 공감 카드 */}
      <section className="px-6 py-16" style={{ background: '#f5ede4' }}>
        <h3 className="text-center text-2xl font-bold mb-10" style={{ color: '#2d2417' }}>마지막으로 부모님 목소리 들은 게 언제인가요?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { text: '바쁘다는 핑계로 또 미뤘어요.\n오늘도 전화 못 드렸네요.', tag: '직장인 30대 자녀' },
            { text: '언제부터인가 먼저 연락 안 오시더라고요.\n그게 더 마음에 걸려요.', tag: '지방 거주 50대 자녀' },
            { text: '커피 한 잔 값으로 매일 안부를 확인할 수 있다니,\n안 할 이유가 없죠.', tag: '맞벌이 40대 부부' },
          ].map((r, i) => (
            <div key={i} className="rounded-2xl p-6 shadow-sm" style={{ background: '#fdf9f5', border: '0.5px solid #e8ddd4' }}>
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-line" style={{ color: '#2d2417', fontStyle: 'italic' }}>"{r.text}"</p>
              <div className="flex items-center justify-end">
                <span className="text-xs px-2 py-1 rounded-full" style={{ color: '#a08878', background: '#f5ede4' }}>{r.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center" style={{ background: '#3d6632' }}>
        <h3 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#e8f0e2' }}>
          오늘부터 부모님 곁에 있어드리세요
        </h3>
        <p className="mb-8 text-sm" style={{ color: '#9dc487' }}>7일 무료 체험 · 카드 불필요 · 언제든 해지 가능</p>
        <Link
          href="/login"
          className="font-bold px-10 py-4 rounded-full text-lg shadow inline-block transition-colors"
          style={{ background: '#e8a84c', color: '#2d2417' }}
        >
          지금 무료로 시작하기
        </Link>
        <div className="mt-4">
          <KakaoShareButton />
        </div>
      </section>

      <footer className="text-center py-6 text-xs border-t" style={{ color: '#a08878', borderColor: '#e8ddd4' }}>
        <p>© 2026 에브리홈 | 사업자등록번호: 592-28-02229</p>
        <p className="mt-1">곁에(gyeote) 서비스는 에브리홈이 운영합니다.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/terms" className="hover:text-gray-600">이용약관</a>
          <a href="/privacy" className="hover:text-gray-600">개인정보처리방침</a>
          <a href="http://pf.kakao.com/_tYbKX/chat" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">고객문의</a>
        </div>
      </footer>
    </main>
  )
}