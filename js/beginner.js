/* ============================================================
 * js/beginner.js — 처음이라면: 초보자 튜토리얼 · 용어 사전 43개 · 기술 가이드 5종
 *
 *  승우 님이 옛 Apps Script 앱(COURT NOTE)에 직접 써 둔 초보용 글을 문장 그대로 옮겼습니다.
 *  (원문 추출: work/legacy-beginner-extract.md 1~4장, 2026-11-20)
 *   · TERMS        용어 사전 43개 (이름·설명 원문 유지)
 *   · TUTORIAL     처음 들어온 사람에게 보여 주던 세 묶음 안내
 *   · SKILL_GUIDE  드라이브·헤어핀·스매시·클리어·언더 5종 (방법·횟수·포인트)
 *   · DRILLS       초보용 맞춤 연습 5종 (방법·횟수·포인트)
 *
 *  붙는 곳
 *   · 일지 & AI: "🏸 처음이라면 · 용어 사전 & 기초 가이드" 카드 → 전체화면 패널
 *     (초심 급수는 크게, 그 위 급수는 한 줄 보조 카드 — 첫 화면을 어지럽히지 않게)
 *   · MY > 훈련 카드: 같은 패널을 언제든 열 수 있는 버튼
 *   · AI 분석 카드: 약점 기술이 드라이브·헤어핀·스매시·클리어·언더와 맞물리면
 *     "쉬운 설명(원문) → 논문 드릴" 순서로 이어 줍니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var hasDom = typeof document !== 'undefined';

  /* 옛 COURT NOTE 원문 그대로 — 맞춤법·띄어쓰기·문장을 고치지 않았습니다 */
  var TERMS = [
    ["스트로크 (Stroke)", "셔틀콕을 라켓으로 치는 동작을 통틀어 스트로크라고 해요. 클리어·드롭·스매시·드라이브처럼 목적과 궤적이 다른 타구가 모두 여기에 포함돼요. 예를 들어 같은 머리 위 타구 준비에서 높고 깊게 보내면 클리어, 빠르게 아래로 보내면 스매시가 될 수 있어요. 연습할 때는 팔만 휘두르지 말고 준비 자세, 몸의 회전, 타점, 임팩트를 연결해 보세요."],
    ["풋워크 (Footwork)", "셔틀콕을 치기 위해 코트 안에서 발을 움직이는 방법이에요. 출발하기, 방향 바꾸기, 멈추기, 타구 후 돌아오기까지 포함해요. 예를 들어 앞쪽 짧은 공을 받아낸 뒤 중앙 쪽으로 돌아와 다음 공을 준비하는 과정이 풋워크예요. 무조건 빨리 뛰기보다 균형을 유지하고 적절한 위치에 도착하는 것이 중요해요."],
    ["스타트", "상대의 타구를 보고 첫 움직임을 시작하는 동작이에요. 상대가 셔틀콕을 치는 순간 방향을 판단해 빠르게 출발하는 것이 핵심이에요. 준비 자세가 높거나 발이 꼬여 있으면 출발이 늦어질 수 있어요. 상대를 보며 균형 잡힌 준비 자세를 유지해 보세요."],
    ["스텝", "코트 안에서 이동할 때 발을 한 번 또는 여러 번 옮기는 동작을 말해요. 작은 스텝으로 거리를 조절하거나 여러 스텝으로 뒤쪽까지 이동할 수 있어요. 공과의 거리에 맞게 보폭을 조절하고, 마지막 발 디딤에서 균형을 잃지 않도록 연습해요."],
    ["런지 (Lunge)", "한쪽 발을 앞으로 크게 내디디며 몸을 낮춰 셔틀콕에 접근하는 동작이에요. 네트 앞에 짧게 떨어진 공을 처리할 때 자주 사용해요. 예를 들어 헤어핀을 받으러 갈 때 앞으로 런지해 라켓을 뻗어요. 발을 디딘 뒤 균형을 잡고 무릎이 불편할 정도로 무리하게 뻗지 마세요."],
    ["스플릿 스텝 (Split Step)", "상대가 셔틀콕을 치는 순간에 맞춰 가볍게 발을 띄우거나 양발로 가볍게 착지해 다음 방향으로 출발할 준비를 하는 동작이에요. 상대의 타구 방향이 정해지기 직전에 준비하면 첫 움직임을 연결하기 쉬워요. 높이 뛰기보다 가볍고 짧게 하며, 착지 후 바로 움직일 수 있게 해요."],
    ["리커버리 (Recovery)", "한 번의 타구를 마친 뒤 다음 공을 준비할 수 있는 위치로 돌아오는 움직임이에요. 예를 들어 앞쪽에서 헤어핀을 친 뒤 다음 공을 대비해 코트 안쪽의 적절한 위치로 돌아와요. 항상 코트의 정중앙에만 서는 것은 아니며, 자신이 친 공과 상대의 가능한 타구에 따라 위치를 정해요."],
    ["헌볼", "코치가 셔틀콕을 여러 개 준비해 두고 선수에게 하나씩 올려주면서 반복적으로 타구 연습을 시키는 훈련 방식이에요. 예를 들어 코치가 뒤쪽으로 공을 계속 올려주면 스매시나 클리어를 반복하고, 여러 방향으로 올려주면 풋워크도 함께 연습할 수 있어요. 단순히 많이 치는 것보다 매번 타점·라켓 면·준비 동작을 확인하고, 코치가 올려주는 위치와 속도에 맞춰 훈련하는 것이 중요해요."],
    ["앞사각", "코트 앞쪽 네트 근처의 좌우 두 공간을 가리키는 현장 표현이에요. 보통 앞쪽 왼쪽과 앞쪽 오른쪽으로 나눠 풋워크 방향을 설명할 때 사용해요. 코치가 “앞사각으로 이동”이라고 하면 네트 앞의 해당 방향으로 이동해 셔틀콕을 처리하고, 타구 후 다음 위치로 돌아오는 동작까지 연결해요."],
    ["뒷사각", "코트 뒤쪽 좌우 두 공간을 가리키는 현장 표현이에요. 뒤쪽 왼쪽과 뒤쪽 오른쪽으로 나눠 이동 훈련이나 공 배급 방향을 설명할 때 사용해요. 뒤로 이동할 때는 셔틀콕을 계속 확인하고, 타구 후에는 다음 공을 대비해 균형을 되찾고 리커버리해요."],
    ["6점 풋워크", "코트의 주요 여섯 방향, 즉 앞쪽 좌우·옆쪽 좌우·뒤쪽 좌우로 이동하는 훈련이에요. 보통 중앙 준비 위치에서 출발해 지정된 방향으로 이동하고 다시 돌아오는 식으로 연습해요. 처음에는 속도보다 올바른 발 디딤과 복귀를 익히고, 익숙해지면 이동 순서와 속도를 높여요."],
    ["푸시 (Push)", "네트 근처에서 셔틀콕을 짧고 빠르게 밀어 상대 코트의 빈 공간으로 보내는 공격 타구예요. 상대의 리시브가 네트 위로 조금 떴을 때 몸 옆이나 빈 공간으로 밀어 보내는 상황을 생각하면 돼요. 큰 스윙보다 짧은 라켓 동작과 정확한 방향이 중요하고, 셔틀콕이 너무 높이 뜨지 않도록 조절해요."],
    ["드롭 (Drop)", "주로 코트 뒤쪽에서 친 셔틀콕을 네트 너머 상대 코트 앞쪽에 짧게 떨어뜨리는 타구예요. 상대가 뒤쪽 공격을 예상해 물러나 있을 때 앞쪽 공간을 노릴 수 있어요. 힘을 무조건 빼는 것이 아니라 타점과 라켓 면을 조절해 네트를 넘길 만큼의 속도를 확보해야 해요."],
    ["헤어핀 (Hairpin)", "네트 바로 앞에서 셔틀콕을 아주 부드럽게 넘겨 상대 코트 네트 앞에 짧게 떨어뜨리는 기술이에요. 상대의 짧은 공을 네트 가까이에서 받아 다시 짧게 보내는 상황에서 사용해요. 세게 치기보다 라켓 면의 각도와 섬세한 터치가 중요하며, 셔틀콕이 네트에 걸리지 않도록 충분히 넘겨야 해요."],
    ["크로스 (Cross-court)", "자신의 코트 한쪽에서 상대 코트의 반대쪽으로 대각선 방향으로 보내는 타구예요. 예를 들어 오른쪽에서 친 공을 상대 왼쪽 공간으로 보내는 식이에요. 크로스 드롭·크로스 헤어핀·크로스 클리어처럼 다양한 기술에 적용할 수 있어요. 대각선 거리가 길기 때문에 상대 위치와 셔틀콕의 궤적을 고려해 정확하게 보내야 해요."],
    ["드라이브 (Drive)", "셔틀콕을 높이 띄우지 않고 네트 위로 낮고 빠르게 보내는 타구예요. 복식에서 빠른 랠리를 이어가거나 상대의 몸과 빈 공간을 공략할 때 자주 사용해요. 큰 스윙보다 짧고 빠른 라켓 동작과 빠른 준비가 중요하고, 상대의 라켓에 막히지 않도록 높이와 방향을 조절해요."],
    ["언더 (Under)", "몸보다 낮은 위치의 셔틀콕을 아래쪽에서 받쳐 올리듯 치는 타구 동작을 말해요. 네트 앞에 떨어지는 공을 들어 올려 상대 코트 뒤쪽으로 보내는 상황에서 자주 사용해요. 언더 클리어는 높고 깊게 보내는 타구를 뜻하는 경우가 많아요. 공을 몸 뒤에서 맞히기보다 가능한 한 몸 앞에서 처리하고, 원하는 거리만큼 올리는 감각을 익혀요."],
    ["스매시 (Smash)", "높은 타점에서 셔틀콕을 빠르고 강하게 아래 방향으로 보내는 공격 기술이에요. 상대가 짧게 올린 공을 공격하거나 빈 공간을 노릴 때 사용해요. 힘만 세게 주기보다 타점, 몸의 회전, 라켓 스윙, 착지 후 균형이 중요해요. 준비가 늦었다면 무리하게 강타하기보다 안정적인 타구를 선택하는 것도 좋아요."],
    ["클리어 (Clear)", "셔틀콕을 높고 깊게 보내 상대 코트 뒤쪽으로 보내는 타구예요. 상대를 뒤로 이동시키거나 자신이 수비 자세를 다시 잡을 시간을 벌 때 사용할 수 있어요. 높고 깊게 보내는 하이 클리어와 비교적 낮고 빠르게 보내는 드리븐 클리어가 있어요. 셔틀콕이 코트 뒤쪽까지 도달하도록 타점과 힘을 조절해요."],
    ["서브 (Serve)", "각 랠리를 시작하기 위해 규칙에 맞게 셔틀콕을 상대 서비스 코트로 보내는 첫 타구예요. 숏 서브는 네트 너머 앞쪽에 낮게 보내고, 롱 서브는 뒤쪽까지 높고 깊게 보내며, 플릭 서브는 짧은 서브처럼 준비하다 빠르고 길게 보내는 방식이에요. 서브 종류는 상황에 맞춰 선택하고, 발 위치와 서비스 동작 등 규칙을 지켜야 해요."],
    ["리시브 (Receive)", "상대가 넣은 서브를 받아 되돌려 보내는 동작이에요. 짧은 서브는 네트 앞에 짧게 넘기거나 밀어 보낼 수 있고, 긴 서브는 상황에 따라 클리어나 공격 타구로 처리할 수 있어요. 상대의 라켓과 셔틀콕을 보며 준비하고, 첫 타구부터 다음 움직임을 생각해요."],
    ["서비스 리턴", "상대의 서브를 받아 상대 코트로 되돌려 보내는 동작으로, 배드민턴에서는 보통 리시브와 거의 같은 뜻으로 사용해요. 서브를 받자마자 단순히 넘기는 것뿐 아니라 상대가 다음 공을 치기 어렵도록 코스와 높이를 선택하는 것이 중요해요."],
    ["서브 폴트 (Service Fault)", "서브를 넣는 과정에서 경기 규칙을 위반해 폴트가 선언되는 상황이에요. 서브 순서나 위치, 올바른 서비스 동작 등을 지키지 않으면 문제가 될 수 있어요. 구체적인 판정은 경기 규정과 심판의 판단을 따라야 하므로 대회에 참가한다면 최신 공식 규칙을 확인해요."],
    ["랠리 (Rally)", "서브가 시작된 뒤 셔틀콕이 바닥에 떨어지거나 규칙 위반이 발생해 플레이가 끝날 때까지 이어지는 교환 과정이에요. 랠리 중에는 클리어·드롭·스매시·수비 등 여러 타구가 이어질 수 있어요. 한 번의 공만 생각하지 말고 상대의 다음 타구와 자신의 위치를 함께 예상해요."],
    ["타점", "라켓으로 셔틀콕을 실제로 맞히는 위치와 높이를 말해요. 같은 스매시라도 높은 타점에서 몸 앞쪽으로 맞히면 공격 각도를 만들기 쉬워요. 반대로 타점이 몸 뒤로 넘어가면 힘과 방향을 조절하기 어려울 수 있어요. 공을 끝까지 보고 자신에게 알맞은 위치에서 맞히는 연습을 해요."],
    ["스윙 (Swing)", "셔틀콕을 치기 위해 라켓을 움직이는 동작이에요. 준비 스윙부터 가속, 임팩트, 타구 후 마무리까지 자연스럽게 이어져요. 큰 동작이 항상 강한 타구를 만드는 것은 아니므로, 정확한 타점과 라켓 면을 유지하며 힘이 부드럽게 전달되도록 연습해요."],
    ["임팩트 (Impact)", "라켓과 셔틀콕이 맞닿는 순간을 말해요. 이 순간의 라켓 면과 스윙 방향, 타점에 따라 셔틀콕의 방향과 속도가 달라져요. 공을 맞히는 순간 라켓 면이 흔들리지 않도록 하고, 손목에만 힘을 주기보다 전체 동작을 연결해요."],
    ["페인트 (Feint)", "상대가 타구 방향이나 종류를 쉽게 예측하지 못하도록 준비 동작이나 시선을 이용해 속이는 플레이예요. 예를 들어 크로스 방향을 예상하게 한 뒤 반대쪽으로 보내는 상황을 생각할 수 있어요. 과장된 동작보다 여러 타구에서 비슷한 준비 자세를 보여주는 것이 효과적이며, 기본 타구가 안정된 뒤 연습해요."],
    ["타이밍 (Timing)", "움직이거나 셔틀콕을 치는 순간을 알맞게 맞추는 것을 뜻해요. 너무 일찍 움직이거나 늦게 맞히면 원하는 타구가 나오기 어려워요. 상대의 타구 순간, 셔틀콕의 낙하, 자신의 발 디딤을 함께 관찰하며 타구 시점을 익혀요."],
    ["수비 (Defense)", "상대의 공격을 받아내고 다음 타구를 이어가는 플레이예요. 스매시를 막거나 빠른 드라이브를 받아내는 상황이 대표적이에요. 라켓을 준비 위치에 두고 몸의 균형을 낮게 유지하며, 막아내는 것에서 끝나지 않고 다음 공을 어디로 보낼지도 생각해요."],
    ["전위", "복식 경기에서 네트 앞쪽 공간을 주로 담당하는 위치와 역할이에요. 상대의 짧은 리턴을 가로채거나 네트 앞에서 공격 기회를 만드는 역할을 해요. 파트너가 뒤에서 공격할 때는 네트 앞을 준비하되, 공의 흐름에 따라 역할을 바꿀 수 있어요."],
    ["후위", "복식 경기에서 코트 뒤쪽 공간을 주로 담당하는 위치와 역할이에요. 클리어와 스매시 등 뒤쪽 타구를 처리하고 공격을 이어가는 경우가 많아요. 후위에 있다고 항상 뒤에만 머무는 것은 아니며, 타구 후 파트너와 함께 다음 상황에 맞게 위치를 조정해요."],
    ["포메이션 (Formation)", "복식에서 두 선수가 코트 안에 어떤 형태로 자리를 잡는지 말해요. 공격할 때는 앞뒤 형태, 수비할 때는 좌우 형태를 자주 사용해요. 셔틀콕이 높이 떠 있는지, 누가 공격권을 갖고 있는지에 따라 적절한 배치를 선택하고 파트너와 공간을 나눠요."],
    ["로테이션 (Rotation)", "복식 경기 중 셔틀콕의 흐름에 따라 두 선수가 서로 위치와 역할을 바꾸는 움직임이에요. 예를 들어 한 선수가 뒤에서 공격한 뒤 앞으로 이동하고 파트너가 뒤쪽을 맡을 수 있어요. 미리 정해진 자리만 고집하지 말고 파트너의 움직임과 타구 방향을 보고 빈 공간이 생기지 않게 조정해요."],
    ["인터셉트 (Intercept)", "상대가 보낸 셔틀콕이 파트너나 자신을 지나가기 전에 앞에서 가로채 타구하는 플레이예요. 복식 전위에서 상대의 약한 리턴을 빠르게 끊어 공격 기회를 만드는 상황이 대표적이에요. 무조건 손을 뻗기보다 파트너의 타구 범위와 자신의 위치를 확인해 충돌을 피해야 해요."],
    ["킬 (Kill)", "네트 근처에 높게 뜬 셔틀콕을 빠르고 강하게 아래로 눌러 보내 랠리를 끝내려는 공격 타구예요. 셔틀콕이 네트 위로 충분히 떠 있을 때 기회를 잡아 짧은 동작으로 처리해요. 네트에 걸리지 않도록 타점과 라켓 면을 조절하고, 공이 낮다면 무리하게 내리치지 않아요."],
    ["범실", "자신의 실수로 셔틀콕을 아웃으로 보내거나 네트에 걸리게 하는 등 상대에게 점수를 내주는 상황을 말해요. 무리한 공격, 늦은 준비, 불안정한 타점 등이 원인이 될 수 있어요. 항상 강하게 치기보다 상황에 맞는 안전한 코스를 선택하고, 실수한 원인을 다음 랠리에서 하나씩 보완해요."],
    ["듀스", "게임의 마무리 점수에 도달했지만 양쪽 점수가 같거나 규정된 점수 차가 나지 않아 승부가 더 이어지는 상황이에요. 일반적인 21점제에서는 20대20이 되면 2점 차가 날 때까지 이어지고, 29대29에서는 다음 점수를 얻어 30점에 먼저 도달한 쪽이 게임을 이겨요. 대회 규정에 따라 형식이 다를 수 있어요."],
    ["포핸드 vs 백핸드", "포핸드는 라켓을 잡은 손 쪽에서 치는 타구이고, 백핸드는 몸의 반대쪽에서 치는 타구예요. 오른손잡이라면 오른쪽 공을 포핸드로 처리하는 경우가 많지만, 실제 선택은 공의 위치와 자세에 따라 달라져요. 한쪽만 고집하지 말고 양쪽에서 준비와 타점을 익혀요."],
    ["드롭 vs 헤어핀", "드롭은 주로 코트 뒤쪽에서 쳐서 상대 코트 앞쪽에 떨어뜨리는 타구이고, 헤어핀은 네트 바로 앞에서 아주 짧게 넘기는 기술이에요. 둘 다 앞쪽 공간을 노리지만 타구하는 위치와 동작이 달라요. 드롭은 상대를 앞뒤로 움직이는 데, 헤어핀은 네트 앞에서 섬세하게 주고받는 데 활용해요."],
    ["푸시 vs 드라이브", "푸시는 짧은 동작으로 셔틀콕을 밀어 빈 공간을 노리는 타구이고, 드라이브는 낮고 빠른 궤적으로 주고받는 타구를 말해요. 푸시는 네트 근처에서 공격 기회를 잡을 때, 드라이브는 빠른 랠리에서 상대와 낮고 빠르게 주고받을 때 자주 사용해요. 실제 상황에 따라 두 동작의 느낌이 겹칠 수 있어요."],
    ["클리어 vs 드롭", "클리어는 상대 코트 뒤쪽으로 높고 깊게 보내는 타구이고, 드롭은 상대 코트 앞쪽으로 짧게 떨어뜨리는 타구예요. 둘을 번갈아 사용하면 상대를 앞뒤로 움직이게 할 수 있어요. 같은 준비 동작에서 두 타구를 모두 구사하면 상대가 방향을 예측하기 어려워져요."],
    ["서브 vs 리시브", "서브는 랠리를 시작하는 첫 타구이고, 리시브는 상대의 서브를 받아내는 동작이에요. 서브하는 선수는 규칙에 맞게 코스와 속도를 선택하고, 리시브하는 선수는 상대의 준비 자세를 읽고 빠르게 반응해요. 두 동작 모두 첫 타구 이후의 다음 움직임까지 준비하는 것이 중요해요."],
  ];

  /* 약점 탭 기술 가이드 5종 — 방법·횟수·포인트가 승우 님 기준으로 적힌 원문 */
  var SKILL_GUIDE = [
    {
      skill: "드라이브", name: "드라이브", sets: "20개씩 3세트",
      paragraphs: [
        { label: "", text: "스트록: 상대와 마주 보고 서서 셔틀콕을 네트에 가깝게 일직선으로 길게 민다는 느낌으로 5분간 랠리를 이어가세요. 네트 높이에 시선을 맞추고 오른발 스텝과 함께 앞쪽에서 스윙해 보세요." },
        { label: "", text: "벽치기: 손목 스냅을 이용해 셔틀콕을 벽에 일직선으로 밀어 치세요. 20개씩 3세트를 목표로 합니다." },
        { label: "", text: "게임 적용: 셔틀콕을 아래로 누르듯 보내 상대가 위로 띄우게 유도한 뒤 공격 기회를 만들어 보세요. 무리하게 아래로 누르기보다 상황에 맞게 안정적으로 조절하세요." },
      ]
    },
    {
      skill: "헤어핀", name: "헤어핀", sets: "하루 10분씩 양쪽 방향",
      paragraphs: [
        { label: "", text: "상대와 네트 앞에서 마주 보고 셔틀콕을 부드럽게 넘기세요. 처음에는 안정적으로 넘기는 데 집중하고, 익숙해지면 네트 가까이에 짧게 붙여 보세요. 하루 10분씩 양쪽 방향을 연습합니다." },
        { label: "쉽게 이해하기:", text: "라켓을 아래에서 위로 들어 올리듯 크게 휘두르기보다, 네트 앞으로 몸을 부드럽게 들어가면서 그 움직임을 이용해 셔틀콕을 살짝 밀어 친다고 생각하세요. 팔에 힘을 주기보다 몸의 이동과 라켓 터치를 부드럽게 연결하는 것이 중요합니다." },
      ]
    },
    {
      skill: "스매시", name: "스매시", sets: "15개씩 3세트",
      paragraphs: [
        { label: "", text: "스매시를 친 뒤 상대가 드라이브성으로 보내면 안정적으로 받아넘기고, 상대가 언더로 높게 올리면 다시 스매시를 시도하는 방식으로 연습하세요. 다른 기본 동작에 익숙해진 뒤 시작하는 것을 추천합니다. 15개씩 3세트를 목표로 합니다." },
        { label: "", text: "스윙할 때 팔만 사용하고 있지 않은지 확인하고, 셔틀콕이 몸보다 앞쪽에 있을 때 타점을 잡는 연습을 해보세요. 스텝으로 셔틀콕 뒤쪽에 빠르게 이동하는 연습도 도움이 됩니다." },
      ]
    },
    {
      skill: "클리어", name: "클리어", sets: "30개씩 3세트",
      paragraphs: [
        { label: "", text: "코트 뒤쪽에서 셔틀콕을 높고 멀리 보내는 것부터 시작하세요. 익숙해지면 뒷라인 가까이에 보내는 정확도를 높입니다. 30개씩 3세트를 목표로 하세요." },
        { label: "", text: "너무 낮으면 상대가 공격하기 쉬워지고, 너무 높으면 상대가 타이밍을 잡기 쉬울 수 있어요. 내 준비 상태와 경기 상황에 맞춰 높이와 길이를 조절하세요. 처음에는 멀리 보내는 것부터 연습하면 됩니다." },
      ]
    },
    {
      skill: "언더", name: "언더", sets: "",
      paragraphs: [
        { label: "", text: "코트 앞쪽에서 셔틀콕을 길게 보내는 연습을 하세요. 멀리 보내려고 힘을 너무 주면 자세가 흔들릴 수 있으니 같은 자세를 유지하는 데 집중하세요." },
        { label: "", text: "준비가 되지 않은 상태에서 셔틀콕을 낮고 빠르게 보내면 다음 공격에 대응하기 어려울 수 있습니다. 낮은 위치에서 힘들게 받아야 한다면 셔틀콕을 높고 멀리 보내 준비 시간을 확보하세요." },
      ]
    },
  ];

  /* 초보용 모드에서 나오던 쉬운 맞춤 연습 5종 — 방법·횟수·포인트 한 세트 */
  var DRILLS = [
    { skill: "드라이브", name: "드라이브",
      method: "가까운 거리에서 파트너와 마주 보고 셔틀콕을 네트 위로 낮고 편하게 주고받으세요. 먼저 정확하게 맞히는 데 집중하고, 익숙해지면 좌우로 조금씩 코스를 바꿔 보세요.",
      sets: "5분씩 2세트", point: "타점을 몸 앞에 두고 라켓을 크게 휘두르지 않으며, 친 뒤 준비 자세로 돌아오기" },
    { skill: "헤어핀", name: "헤어핀",
      method: "네트 앞에서 파트너와 마주 보고 셔틀콕을 부드럽게 넘기세요. 네트 앞으로 몸을 조금 이동하며 라켓 면으로 가볍게 터치하고, 큰 팔 스윙은 피하세요.",
      sets: "5분씩 2세트", point: "힘보다 부드러운 터치와 안정적인 자세 우선" },
    { skill: "스매시", name: "스매시",
      method: "처음에는 강하게 때리기보다 셔틀콕이 몸 앞에 왔을 때 편안한 스윙으로 코트 안에 보내는 연습부터 하세요. 통증이 있으면 중단하세요.",
      sets: "10회씩 2세트", point: "타점과 균형을 우선하고 무리하게 힘을 주지 않기" },
    { skill: "클리어", name: "클리어",
      method: "코트 뒤쪽에서 셔틀콕을 상대 코트 뒤쪽으로 높고 길게 보내는 연습을 하세요. 처음에는 거리보다 안정적으로 높게 보내는 데 집중하세요.",
      sets: "10회씩 2세트", point: "셔틀콕 뒤로 이동하고 친 뒤 준비 자세로 복귀" },
    { skill: "언더", name: "언더",
      method: "코트 앞쪽이나 낮은 위치의 셔틀콕을 라켓으로 부드럽게 받아 상대 코트 뒤쪽으로 높게 보내세요.",
      sets: "10회씩 2세트", point: "무리하게 힘주지 말고 셔틀콕을 높고 멀리 보내 다음 동작 준비하기" },
  ];

  var TUTORIAL = {
    title: '🏸 처음 배우는 배드민턴',
    welcome: 'COURT NOTE 초보자 튜토리얼에 온 걸 환영해요!',
    intro: '처음에는 모든 용어를 외우려고 하지 않아도 돼요. 이동 기술, 타구 기술, 경기 운영 용어를 조금씩 알아가면 돼요.',
    groups: [
      {
        icon: '👟', title: '1. 이동 기술',
        terms: '풋워크 · 스플릿 스텝 · 런지 · 리커버리',
        desc: '정확한 위치로 이동한 뒤 다음 공을 준비하는 방법이에요.'
      },
      {
        icon: '🏸', title: '2. 타구 기술',
        terms: '클리어 · 드롭 · 스매시 · 푸시 · 드라이브 · 헤어핀',
        desc: '셔틀콕을 어디로, 어떤 높이와 속도로 보낼지 배우는 기술이에요.'
      },
      {
        icon: '🤝', title: '3. 경기 운영',
        terms: '서브 · 리시브 · 포메이션 · 로테이션 · 전술',
        desc: '랠리를 시작하고 파트너와 코트를 나눠 사용하는 방법이에요.'
      }
    ],
    hint: '위쪽 검색창에서 언제든 용어를 찾아볼 수 있어요.',
    termsAction: '📚 용어 전체 보기 · 검색',
    guideAction: '🏸 기술 가이드 5종',
    guideIntro: '처음에는 정확도와 안정성을 우선하고, 익숙해지면 속도와 위치를 조절해 보세요.'
  };

  /* ---------- 작은 도구 ---------- */
  function esc(s) {
    if (BM.util && BM.util.esc) return BM.util.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) {
    return (BM.ui && BM.ui.icon) ? BM.ui.icon(name, cls) : '';
  }
  function low(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* ---------- 급수: 초심(초보·입문 포함)인가 ----------
   * 온보딩 급수 7단계(초심·D조·C조·B조·A조·선수부·자강)에서 '초심'만 참입니다.
   * 옛 앱의 '초보용 모드'에서만 초보 가이드가 보이던 동작을 급수로 옮긴 것입니다. */
  function isBeginnerGrade(level) {
    var s = String(level == null ? '' : level).trim().replace(/\s+/g, '');
    if (!s) return false;
    if (BM.ai && typeof BM.ai.gradeOf === 'function') return BM.ai.gradeOf(s) === '초심';
    return s.indexOf('초심') >= 0 || s.indexOf('초보') >= 0 || s.indexOf('입문') >= 0;
  }

  /* ---------- 용어 검색 ----------
   * 옛 앱과 같이 이름 + 설명을 함께 걸러 냅니다. 빈 검색어는 43개 전체. */
  function searchTerms(query, list) {
    var all = list || TERMS;
    var q = low(query);
    if (!q) return all.slice();
    return all.filter(function (t) { return low(t[0] + ' ' + t[1]).indexOf(q) >= 0; });
  }

  /* ---------- 기술 이름 맞추기 ----------
   * '헤어핀' ← '네트 앞 헤어핀 정확도'처럼 AI 드릴 이름에도 걸리게 양방향 포함으로 찾습니다. */
  function pick(list, skill) {
    var key = low(skill);
    if (!key) return null;
    for (var i = 0; i < list.length; i++) {
      var name = low(list[i].skill || list[i].name);
      if (key === name || key.indexOf(name) >= 0 || name.indexOf(key) >= 0) return list[i];
    }
    return null;
  }
  function guideForSkill(skill) { return pick(SKILL_GUIDE, skill); }
  function drillForSkill(skill) { return pick(DRILLS, skill); }

  /* 여러 기술 이름(약점 칩·드릴 이름)에서 가이드가 있는 것만 겹치지 않게 */
  function guidesForSkills(names) {
    var out = [], seen = {};
    (names || []).forEach(function (n) {
      var g = guideForSkill(n);
      if (g && !seen[g.skill]) { seen[g.skill] = 1; out.push(g); }
    });
    return out;
  }

  /* ---------- 일지 & AI 첫머리 카드 ---------- */
  function entryHtml(state) {
    var level = (state && state.me && state.me.level) || '';
    var beginner = isBeginnerGrade(level);
    var sig = 'beg|' + (beginner ? '1' : '0');
    var label = '🏸 처음이라면 · 용어 사전 &amp; 기초 가이드';
    if (beginner) {
      return '' +
        '<section class="card card--beg" data-region="beginner" data-sig="' + sig + '">' +
        '<div class="beg__in">' +
        '<p class="beg__eyebrow">' + icon('spark') + '처음 시작하는 분께</p>' +
        '<h2 class="beg__t">' + label + '</h2>' +
        '<p class="beg__s">풋워크·드롭·헤어핀처럼 코트에서 자주 듣는 말 43개와, 드라이브·헤어핀·스매시·클리어·언더 기본 가이드를 한 화면에서 봐요.</p>' +
        '<div class="beg__stats">' +
        '<div><b>' + TERMS.length + '</b><span>용어</span></div>' +
        '<div><b>' + SKILL_GUIDE.length + '</b><span>기술 가이드</span></div>' +
        '<div><b>' + TUTORIAL.groups.length + '</b><span>튜토리얼 묶음</span></div>' +
        '</div>' +
        '<button type="button" class="btn btn--primary btn--big beg__open" data-act="beginner-open" data-beg-tab="intro">용어 사전 & 기초 가이드 열기</button>' +
        '</div></section>';
    }
    return '' +
      '<section class="card card--beg-slim" data-region="beginner" data-sig="' + sig + '">' +
      '<button type="button" class="beg-slim" data-act="beginner-open" data-beg-tab="intro" aria-label="초보자 용어 사전과 기초 가이드 열기">' +
      '<span class="beg-slim__t">' + label +
      '<small>용어 ' + TERMS.length + '개 · 기술 가이드 ' + SKILL_GUIDE.length + '종 · 튜토리얼 ' + TUTORIAL.groups.length + '묶음</small></span>' +
      icon('arrow', 'beg-slim__car') +
      '</button></section>';
  }

  /* ---------- 패널 안쪽 화면 ---------- */
  function introBody() {
    return '' +
      '<p class="bgx__hi">' + esc(TUTORIAL.welcome) + '</p>' +
      '<p class="bgx__p">' + esc(TUTORIAL.intro) + '</p>' +
      TUTORIAL.groups.map(function (g) {
        return '<div class="bgx__group">' +
          '<h3>' + esc(g.icon + ' ' + g.title) + '</h3>' +
          '<p class="bgx__terms">' + esc(g.terms) + '</p>' +
          '<p>' + esc(g.desc) + '</p></div>';
      }).join('') +
      '<p class="bgx__hint">' + esc(TUTORIAL.hint) + '</p>' +
      '<div class="bgx__acts">' +
      '<button type="button" class="btn btn--primary grow" data-beg-tab="terms">' + esc(TUTORIAL.termsAction) + '</button>' +
      '<button type="button" class="btn btn--ghost grow" data-beg-tab="guide">' + esc(TUTORIAL.guideAction) + '</button>' +
      '</div>';
  }

  function termCard(t) {
    return '<details class="bgt">' +
      '<summary class="bgt__sum"><span class="bgt__name">' + esc(t[0]) + '</span>' +
      '<i class="bgt__plus" aria-hidden="true">＋</i></summary>' +
      '<p class="bgt__p">' + esc(t[1]) + '</p></details>';
  }

  function termsBody(query) {
    var found = searchTerms(query);
    var list = found.length
      ? found.map(termCard).join('')
      : '<div class="bgt bgt--empty">검색 결과가 없어요. 다른 단어로 검색해 보세요.</div>';
    return '<div class="bgp__list" data-beg-list>' + list + '</div>' +
      '<p class="bgp__count" data-beg-count>' + found.length + '개 용어 표시 중</p>';
  }

  function guideCard(g) {
    var paras = g.paragraphs.map(function (p) {
      return '<p class="bgt__p">' + (p.label ? '<b>' + esc(p.label) + '</b> ' : '') + esc(p.text) + '</p>';
    }).join('');
    return '<details class="bgt bgt--guide" data-beg-guide="' + esc(g.skill) + '">' +
      '<summary class="bgt__sum"><span class="bgt__name">' + esc(g.name) + '</span>' +
      (g.sets ? '<i class="pill pill--ghost">' + esc(g.sets) + '</i>' : '<i class="bgt__plus" aria-hidden="true">＋</i>') +
      '</summary><div class="bgt__body">' + paras + '</div></details>';
  }

  function drillCard(d) {
    return '<details class="bgt bgt--drill">' +
      '<summary class="bgt__sum"><span class="bgt__name">' + esc(d.name + ' 연습') + '</span>' +
      '<i class="pill pill--ghost">' + esc(d.sets) + '</i></summary>' +
      '<div class="bgt__body"><dl class="bgd">' +
      '<dt>방법</dt><dd>' + esc(d.method) + '</dd>' +
      '<dt>횟수</dt><dd>' + esc(d.sets) + '</dd>' +
      '<dt>포인트</dt><dd>' + esc(d.point) + '</dd>' +
      '</dl></div></details>';
  }

  function guideBody() {
    return '' +
      '<p class="bgx__p">' + esc(TUTORIAL.guideIntro) + '</p>' +
      '<div class="bgp__list">' + SKILL_GUIDE.map(guideCard).join('') + '</div>' +
      '<h3 class="bgp__h">초보자 맞춤 연습 <small>방법 · 횟수 · 포인트</small></h3>' +
      '<div class="bgp__list">' + DRILLS.map(drillCard).join('') + '</div>';
  }

  function bodyHtml(tab, query) {
    if (tab === 'terms') return termsBody(query);
    if (tab === 'guide') return guideBody();
    return introBody();
  }

  /* ---------- AI 분석 카드: 쉬운 설명 → 논문 드릴 ---------- */
  function easyGuideHtml(names) {
    var guides = guidesForSkills(names);
    if (!guides.length) return '';
    var namesText = guides.map(function (g) { return g.name; }).join(' · ');
    return '<details class="fold fold--ai fold--beg" data-fold="easy-guide">' +
      '<summary class="fold__sum"><span>처음이라면 · 쉬운 설명 <small>' + esc(namesText) + '</small></span>' +
      '<i class="fold__val">' + guides.length + '가지</i>' + icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' +
      guides.map(function (g) {
        return '<div class="easy">' +
          '<p class="easy__name">' + esc(g.name) +
          (g.sets ? '<span class="pill pill--ghost">' + esc(g.sets) + '</span>' : '') + '</p>' +
          g.paragraphs.map(function (p) {
            return '<p class="easy__p">' + (p.label ? '<b>' + esc(p.label) + '</b> ' : '') + esc(p.text) + '</p>';
          }).join('') +
          '</div>';
      }).join('') +
      '<button type="button" class="linkbtn mt8" data-act="beginner-open" data-beg-tab="guide">기술 가이드에서 더 보기</button>' +
      '</div></details>';
  }

  /* ---------- 전체화면 패널 (DOM) ---------- */
  var panelEl = null;
  var panelState = { tab: 'intro', query: '', skill: '' };
  var TABS = [
    { id: 'intro', label: '튜토리얼' },
    { id: 'terms', label: '용어 사전' },
    { id: 'guide', label: '기술 가이드' }
  ];

  function shellHtml() {
    return '' +
      '<div class="bgp__backdrop" data-beg-close="1"></div>' +
      '<div class="bgp__panel" role="dialog" aria-modal="true" aria-label="초보자 용어 사전과 기초 가이드">' +
      '<div class="bgp__head"><h2>🏸 처음이라면</h2>' +
      '<button type="button" class="iconbtn" data-beg-close="1" aria-label="닫기">' + icon('close') + '</button></div>' +
      '<div class="bgp__tabs" role="tablist" aria-label="초보자 안내 종류">' +
      TABS.map(function (t) {
        return '<button type="button" class="bgp__tab" role="tab" data-beg-tab="' + t.id + '" aria-selected="false">' + t.label + '</button>';
      }).join('') + '</div>' +
      '<div class="bgp__search"><label class="bgp__searchbox">' + icon('search') +
      '<input type="search" data-beg-search placeholder="용어 검색 (예: 풋워크, 드롭, 듀스)" aria-label="배드민턴 용어 검색" autocomplete="off" spellcheck="false">' +
      '</label></div>' +
      '<div class="bgp__body" data-beg-body></div>' +
      '</div>';
  }

  function paint() {
    if (!panelEl) return;
    var body = panelEl.querySelector('[data-beg-body]');
    if (body) body.innerHTML = bodyHtml(panelState.tab, panelState.query);
    Array.prototype.forEach.call(panelEl.querySelectorAll('[data-beg-tab]'), function (b) {
      var on = b.getAttribute('data-beg-tab') === panelState.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var input = panelEl.querySelector('[data-beg-search]');
    if (input && input.value !== panelState.query) input.value = panelState.query;
    if (body) body.scrollTop = 0;
    /* 기술 가이드로 바로 열었으면 그 기술을 펼쳐 둡니다 */
    if (panelState.tab === 'guide' && panelState.skill) {
      var card = panelEl.querySelector('[data-beg-guide="' + panelState.skill + '"]');
      if (card) {
        card.open = true;
        if (card.scrollIntoView) card.scrollIntoView({ block: 'center' });
      }
      panelState.skill = '';
    }
  }

  function close() {
    if (!hasDom || !panelEl) return;
    var node = panelEl;
    panelEl = null;
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    node.classList.remove('is-on');
    if (document.body) document.body.classList.remove('no-scroll');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
  }

  /* 뒤로 가기: 패널만 닫고 앱은 나가지 않습니다 */
  function onPop() {
    if (!panelEl) return;
    panelEl = null;                                   /* close()가 다시 기록을 건드리지 않게 */
    var node = document.getElementById('beginnerPanel');
    if (node) {
      node.classList.remove('is-on');
      if (document.body) document.body.classList.remove('no-scroll');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
  }

  function onClick(ev) {
    if (ev.target.closest('[data-beg-close]')) { ev.preventDefault(); close(); return; }
    var tab = ev.target.closest('[data-beg-tab]');
    if (tab) {
      ev.preventDefault();
      var next = tab.getAttribute('data-beg-tab');
      if (next === panelState.tab) return;
      panelState.tab = next;
      if (next !== 'terms') { panelState.query = ''; }
      paint();
      if (BM.ui && BM.ui.haptic) BM.ui.haptic(6);
    }
  }

  function onInput(ev) {
    var input = ev.target.closest ? ev.target.closest('[data-beg-search]') : null;
    if (!input) return;
    panelState.query = input.value;
    if (panelState.tab !== 'terms') panelState.tab = 'terms';
    if (!panelEl) return;
    var body = panelEl.querySelector('[data-beg-body]');
    if (body) body.innerHTML = termsBody(panelState.query);
    Array.prototype.forEach.call(panelEl.querySelectorAll('[data-beg-tab]'), function (b) {
      var on = b.getAttribute('data-beg-tab') === 'terms';
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function open(opts) {
    if (!hasDom) return null;
    opts = opts || {};
    panelState.tab = opts.tab === 'terms' || opts.tab === 'guide' ? opts.tab : 'intro';
    panelState.query = '';
    panelState.skill = opts.skill ? (guideForSkill(opts.skill) || {}).skill || '' : '';
    if (!panelEl) {
      var node = document.createElement('div');
      node.id = 'beginnerPanel';
      node.className = 'bgp';
      node.innerHTML = shellHtml();
      document.body.appendChild(node);
      document.body.classList.add('no-scroll');
      panelEl = node;
      node.addEventListener('click', onClick);
      node.addEventListener('input', onInput);
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('popstate', onPop);
      if (BM.ui && BM.ui.overlay) BM.ui.overlay.open();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { node.classList.add('is-on'); });
      else node.classList.add('is-on');
    }
    paint();
    return panelEl;
  }

  BM.beginner = {
    TERMS: TERMS,
    TUTORIAL: TUTORIAL,
    SKILL_GUIDE: SKILL_GUIDE,
    DRILLS: DRILLS,
    TABS: TABS,
    isBeginnerGrade: isBeginnerGrade,
    searchTerms: searchTerms,
    guideForSkill: guideForSkill,
    drillForSkill: drillForSkill,
    guidesForSkills: guidesForSkills,
    entryHtml: entryHtml,
    bodyHtml: bodyHtml,
    introBody: introBody,
    termsBody: termsBody,
    guideBody: guideBody,
    easyGuideHtml: easyGuideHtml,
    open: open,
    close: close,
    isOpen: function () { return !!panelEl; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
