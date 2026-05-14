export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-400 mb-10">최종 수정일: 2026년 5월 14일</p>

      {[
        {
          title: '1. 수집하는 개인정보',
          content: '회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.\n- 이용자: 카카오 계정 이메일, 닉네임\n- 부모님: 성함, 전화번호',
        },
        {
          title: '2. 개인정보 수집 및 이용 목적',
          content: '수집한 개인정보는 다음 목적으로만 사용됩니다.\n- 서비스 제공: 카카오톡 안부 메시지 발송\n- 서비스 개선: 응답률 분석 및 리포트 생성\n- 결제 처리: 구독 결제 및 환불 처리',
        },
        {
          title: '3. 개인정보 보유 및 이용 기간',
          content: '개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴 또는 구독 해지 후 30일 이내에 삭제됩니다. 단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보유합니다.',
        },
        {
          title: '4. 개인정보 제3자 제공',
          content: '회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 서비스 제공을 위해 카카오 알림톡 발송 서비스(솔라피)에 전화번호가 제공될 수 있습니다.',
        },
        {
          title: '5. 개인정보 처리 위탁',
          content: '회사는 서비스 제공을 위해 다음 업체에 개인정보 처리를 위탁합니다.\n- Supabase: 데이터베이스 저장 및 관리\n- 솔라피: 카카오 알림톡 발송\n- 토스페이먼츠 / 카카오페이: 결제 처리',
        },
        {
          title: '6. 이용자의 권리',
          content: '이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있습니다. 개인정보 삭제를 원하는 경우 kindboy0427@gmail.com으로 요청해주세요. 요청 후 5영업일 이내에 처리됩니다.',
        },
        {
          title: '7. 개인정보 보안',
          content: '회사는 개인정보의 안전한 관리를 위해 데이터 암호화, 접근 권한 관리 등의 보안 조치를 취하고 있습니다.',
        },
        {
          title: '8. 문의',
          content: '개인정보 처리에 관한 문의는 아래로 연락해주세요.\n이메일: kindboy0427@gmail.com',
        },
      ].map((item, i) => (
        <section key={i} className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-2">{item.title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{item.content}</p>
        </section>
      ))}

      <div className="border-t pt-6 mt-6 text-sm text-gray-400">
        <p>사업자명: 에브리홈</p>
        <p>사업자등록번호: 592-28-02229</p>
        <p>문의: kindboy0427@gmail.com</p>
      </div>
    </main>
  )
}