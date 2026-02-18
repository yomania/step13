type YakuInfo = {
    key: string;
    name: string;
    han: string;
    condition: string;
    tip: string;
};

const YAKU_INFOS: YakuInfo[] = [
    { key: 'riichi', name: '리치 (자동)', han: '1판', condition: '텐파이 상태에서 자동 리치 적용', tip: '기본 공격 루트. 도라와 조합하면 타점 상승.' },
    { key: 'tanyao', name: '탕야오', han: '1판', condition: '2~8 수패만으로 구성 (자패/1/9 제외)', tip: '가벼운 손에서 가장 자주 노리는 역.' },
    { key: 'pinfu', name: '핑후', han: '1판', condition: '순자 4개 + 비역패 머리 + 양면 대기', tip: '타점은 낮지만 속도가 빠름.' },
    { key: 'iipeikou', name: '이페코', han: '1판', condition: '같은 수패의 동일 순자 2세트', tip: '멘젠에서 핑후와 자주 같이 붙음.' },
    { key: 'yakuhai', name: '역패', han: '1판', condition: '자풍/삼원패를 각(3장)으로 구성', tip: '17보에서는 장풍패 역을 사용하지 않음.' },
    { key: 'chiitoitsu', name: '치또이츠', han: '2판', condition: '서로 다른 또이츠 7개', tip: '형태가 특수해서 일반 멘츠 손과 평가가 다름.' },
    { key: 'toitoi', name: '또이또이', han: '2판', condition: '모든 몸통이 각자 형태', tip: '중장패보다 역패/자패 활용이 쉬움.' },
    { key: 'sanankou', name: '삼암각', han: '2판', condition: '암각 3개 이상', tip: '또이또이와 함께 고타점 루트가 가능.' },
    { key: 'sanshoku_doujun', name: '삼색동순', han: '2판', condition: '만/통/삭에서 같은 숫자 순자 3개', tip: '형태가 넓어 조패 단계에서 의식하기 좋음.' },
    { key: 'sanshoku_doukou', name: '삼색동각', han: '2판', condition: '만/통/삭에서 같은 숫자 각 3개', tip: '패 효율보다 완성 타이밍을 보는 역.' },
    { key: 'ittsuu', name: '일기통관', han: '2판', condition: '한 수패에서 123 + 456 + 789 완성', tip: '초반에 같은 수패가 몰리면 후보로 고려.' },
    { key: 'chanta', name: '찬타', han: '2판', condition: '모든 몸통/머리에 1, 9, 자패 포함', tip: '자패 활용도가 높고 혼일색으로 이어지기 좋음.' },
    { key: 'junchan', name: '준찬', han: '3판', condition: '모든 몸통/머리에 1, 9 포함 (자패 없음)', tip: '난이도는 높지만 판수가 큼.' },
    { key: 'honitsu', name: '혼일색', han: '3판', condition: '한 종류 수패 + 자패', tip: '조패 단계에서 수패 한 종류 집중이 핵심.' },
    { key: 'chinitsu', name: '청일색', han: '6판', condition: '한 종류 수패만 사용', tip: '최고 난이도 고타점 역 중 하나.' },
    { key: 'honroutou', name: '혼노두', han: '2판', condition: '1, 9, 자패로만 구성', tip: '또이또이/치또이츠와 결합이 쉬운 편.' },
    { key: 'shousangen', name: '소삼원', han: '2판', condition: '삼원패 2각 + 삼원패 머리', tip: '삼원패가 2종류 이상 보이면 즉시 체크.' }
];

interface YakuInfoLayerProps {
    open: boolean;
    onClose: () => void;
}

export function YakuInfoLayer({ open, onClose }: YakuInfoLayerProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl glass-panel shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-cyan-300">17보 역정보</h2>
                        <p className="text-xs text-slate-400 mt-1">로비/조패 단계에서 참고하는 핵심 역 요약</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm"
                    >
                        닫기
                    </button>
                </div>
                <div className="overflow-y-auto thin-scrollbar max-h-[calc(90vh-88px)] p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {YAKU_INFOS.map((yaku) => (
                            <div key={yaku.key} className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-base font-bold text-white">{yaku.name}</div>
                                    <div className="text-xs font-bold text-yellow-300">{yaku.han}</div>
                                </div>
                                <div className="mt-2 text-xs text-slate-300">조건: {yaku.condition}</div>
                                <div className="mt-1 text-xs text-cyan-300">팁: {yaku.tip}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-xs text-amber-200">
                        참고: 도라는 보너스 판수이며 단독 역으로는 성립하지 않습니다.
                    </div>
                </div>
            </div>
        </div>
    );
}
