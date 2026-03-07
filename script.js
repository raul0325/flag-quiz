/**
 * 世界の国旗クイズ - Game Logic
 */

class FlagQuizGame {
    constructor() {
        this.countries = [];
        this.levels = { 1: [], 2: [], 3: [], 4: [] };
        this.currentQuestion = null;
        this.questionsCount = 0;
        this.score = 0;
        this.maxQuestions = 10;
        this.usedIndices = new Set(); // 実際には name を保存して重複回避
        this.highScore = localStorage.getItem('flagQuizHighScore') || 0;
        this.perfectCount = parseInt(localStorage.getItem('flagQuizPerfectCount') || '0', 10);
        this.playCount = parseInt(localStorage.getItem('flagQuizPlayCount') || '0', 10);

        // 有名な国の定義（日本語名でマッチング）
        // レベル1: 超有名・よく聞く国 (約30カ国)
        // レベル2: 有名・スポーツやニュースで聞く国 (約25カ国)
        this.famousCountries = {
            lv1: ["日本", "アメリカ", "中国", "フランス", "イタリア", "ドイツ", "イギリス", "韓国", "ブラジル", "カナダ", "スペイン", "ロシア", "インド", "オーストラリア", "エジプト", "メキシコ", "タイ", "台湾", "スイス", "アルゼンチン", "ニュージーランド", "ケニア", "サウジアラビア", "シンガポール", "ギリシャ", "トルコ", "オランダ", "スウェーデン", "ペルー", "モンゴル"],
            lv2: ["ポルトガル", "ベルギー", "フィリピン", "ベトナム", "インドネシア", "マレーシア", "南アフリカ", "チリ", "コロンビア", "キューバ", "ジャマイカ", "ノルウェー", "フィンランド", "デンマーク", "ポーランド", "ウクライナ", "イラン", "イラク", "アラブ首長国連邦", "イスラエル", "モロッコ", "ナイジェリア", "ガーナ", "カンボジア", "ミャンマー"],
            lv3: ["チェコ", "ハンガリー", "ルーマニア", "セルビア", "クロアチア", "アイルランド", "アイスランド", "カタール", "パキスタン", "バングラデシュ", "スリランカ", "ネパール", "キューバ", "パナマ", "コスタリカ", "ウルグアイ", "パラグアイ", "ボリビア", "エクアドル", "ベネズエラ"]
        };

        // 音のON/OFF状態（LocalStorageから読み込み）
        this.soundEnabled = localStorage.getItem('flagQuizSound') !== 'false'; // デフォルトtrue
        this.audioCtx = null;

        // UI Elements
        this.screens = {
            menu: document.getElementById('menu-screen'),
            quiz: document.getElementById('quiz-screen'),
            result: document.getElementById('result-screen'),
            record: document.getElementById('record-screen') // 追加
        };
        this.loadingOverlay = document.getElementById('loading-overlay');

        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.startHardBtn = document.getElementById('start-hard-btn');
        this.startExtremeBtn = document.getElementById('start-extreme-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');
        this.recordBtn = document.getElementById('record-btn');
        this.closeRecordBtn = document.getElementById('close-record-btn');
        this.soundToggleBtn = document.getElementById('sound-toggle-btn'); // 追加

        // BGM 要素
        this.bgmAudio = document.getElementById('bgm');

        // Stats
        this.highScoreDisplay = document.getElementById('high-score');
        this.currentScoreDisplay = document.getElementById('current-score');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.questionNumberDisplay = document.getElementById('question-number');
        this.progressBar = document.getElementById('progress-bar');

        // Quiz elements
        this.flagImage = document.getElementById('flag-image');
        this.optionsContainer = document.getElementById('options-container');

        this.init();
    }

    async init() {
        this.updateHighScoreDisplay();
        this.checkUnlockStatus();
        this.updateSoundIcon();
        this.attachEventListeners();
        await this.loadCountryData();
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame(0));
        this.startHardBtn.addEventListener('click', () => this.startGame(3)); // ふつう（4問目基準）からスタート
        this.startExtremeBtn.addEventListener('click', () => this.startGame(5)); // むずかしい（6問目基準）からスタート
        this.restartBtn.addEventListener('click', () => this.startGame(0));
        this.backToMenuBtn.addEventListener('click', () => {
            this.checkUnlockStatus();
            this.showScreen('menu');
        });

        // 記録画面の開閉
        this.recordBtn.addEventListener('click', () => this.showRecordScreen());
        this.closeRecordBtn.addEventListener('click', () => this.showScreen('menu'));

        // 音のトグル
        if (this.soundToggleBtn) {
            this.soundToggleBtn.addEventListener('click', () => this.toggleSound());
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('flagQuizSound', this.soundEnabled);
        this.updateSoundIcon();

        if (this.soundEnabled) {
            this.initAudio();
            if (this.bgmAudio) this.bgmAudio.play().catch(e => console.log("BGM再生不可:", e));
        } else {
            if (this.bgmAudio) this.bgmAudio.pause();
        }
    }

    updateSoundIcon() {
        if (this.soundToggleBtn) {
            this.soundToggleBtn.textContent = this.soundEnabled ? '🔊 音あり' : '🔇 音なし';
        }
        if (this.soundEnabled && this.bgmAudio && this.bgmAudio.paused) {
            // 自動再生はブラウザにブロックされる可能性があるので何もしない
        } else if (!this.soundEnabled && this.bgmAudio) {
            this.bgmAudio.pause();
        }
    }

    initAudio() {
        if (!this.soundEnabled) return;
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playSound(type) {
        if (!this.soundEnabled) return;
        this.initAudio();

        const actx = this.audioCtx;
        if (!actx) return;

        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);

        const now = actx.currentTime;

        if (type === 'correct') {
            // ピコーン！ (正解音: 高音で2連続) A5 -> E6
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.setValueAtTime(1318.51, now + 0.1);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);

            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'wrong') {
            // ブブー (不正解音: 低音で2連続)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.setValueAtTime(150, now + 0.15);
            osc.frequency.setValueAtTime(120, now + 0.2);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain.gain.setValueAtTime(0.3, now + 0.15);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.25);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);

            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    checkUnlockStatus() {
        const unlockMessage = document.getElementById('unlock-message');
        if (this.perfectCount >= 1) { // 3回から1回へ緩和
            unlockMessage.classList.remove('hidden');
            this.startHardBtn.classList.remove('hidden');
            this.startExtremeBtn.classList.remove('hidden');
        } else {
            unlockMessage.classList.add('hidden');
            this.startHardBtn.classList.add('hidden');
            this.startExtremeBtn.classList.add('hidden');
        }
    }

    showRecordScreen() {
        document.getElementById('record-play-count').textContent = this.playCount;
        document.getElementById('record-high-score').textContent = this.highScore;
        document.getElementById('record-perfect-count').textContent = this.perfectCount;
        this.showScreen('record');
    }

    async loadCountryData() {
        this.showLoading(true);
        try {
            // REST Countries API (v3.1)
            // 必要なフィールドだけを取得して軽量化
            const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,translations');
            const data = await response.json();

            // 日本語名がある国のみをフィルタリング
            this.countries = data.map(country => {
                // 日本語の翻訳データがない場合は除外するために undefined を返す
                const commonName = country.translations?.jpn?.common;
                if (!commonName) return null;

                let flagUrl = country.flags.svg || country.flags.png;

                // ベネズエラの国旗を「左上に紋章（イラスト）がある政府旗」に差し替え
                if (commonName === 'ベネズエラ') {
                    flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/0/06/Flag_of_Venezuela.svg';
                }

                return {
                    name: commonName,
                    flag: flagUrl
                };
            }).filter(c => c !== null && c.name && c.flag);

            // 難易度別に分類
            this.countries.forEach(country => {
                if (this.famousCountries.lv1.includes(country.name)) {
                    this.levels[1].push(country);
                } else if (this.famousCountries.lv2.includes(country.name)) {
                    this.levels[2].push(country);
                } else if (this.famousCountries.lv3.includes(country.name)) {
                    this.levels[3].push(country);
                } else {
                    this.levels[4].push(country);
                }
            });

            console.log(`データを読み込みました: Lv1:${this.levels[1].length}, Lv2:${this.levels[2].length}, Lv3:${this.levels[3].length}, Lv4:${this.levels[4].length}`);

            // 背景に国旗を散りばめる
            this.spawnBackgroundFlags();

        } catch (error) {
            console.error('データ取得エラー:', error);
            alert('国旗データの取得に失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    startGame(difficultyOffset = 0) {
        // 音声を初期化・BGMをスタートさせる
        this.initAudio();
        if (this.soundEnabled && this.bgmAudio) {
            this.bgmAudio.play().catch(e => console.log('BGM再生エラー:', e));
        }

        this.playCount++;
        localStorage.setItem('flagQuizPlayCount', this.playCount);

        this.score = 0;
        this.questionsCount = difficultyOffset; // ベースの難易度を底上げする
        this.usedIndices.clear();
        this.updateScoreDisplay();
        this.showScreen('quiz');
        this.nextQuestion();
    }

    getCurrentPool() {
        // 問題数に応じて出題プールを選択
        if (this.questionsCount <= 3) return this.levels[1];      // 1-3問: 超初級
        if (this.questionsCount <= 5) return this.levels[2];      // 4-5問: 初級
        if (this.questionsCount <= 8) return this.levels[3];      // 6-8問: 中級
        return this.levels[4];                                   // 9-10問: 上級（その他すべて）
    }

    getDifficultyInfo() {
        if (this.questionsCount <= 3) return { label: "かんたん", class: "badge-easy" };
        if (this.questionsCount <= 5) return { label: "ふつう", class: "badge-medium" };
        if (this.questionsCount <= 8) return { label: "むずかしい", class: "badge-hard" };
        return { label: "激ムズ！", class: "badge-extreme" };
    }

    nextQuestion() {
        // オフセットにより maxQuestions を超える場合は終了（実質プレイ問題数は10問で固定せず、到達点で判定）
        // 実際には10回解かせるため、maxQuestions ではなく fixed_turns で管理するべきだが、
        // 今回の仕様設計としては「問題番号の表示」として 10 で終了とする
        if (this.questionsCount >= this.maxQuestions) {
            this.endGame();
            return;
        }

        this.questionsCount++;
        const diffInfo = this.getDifficultyInfo();

        // オフセット開始時は1問目からカウントアップする表示調整も可能だが、
        // 今回は「第X問」ではなく「（残り問題数）」にしなくても良い。
        // シンプルに「現在のレベル」を見せる。
        this.questionNumberDisplay.innerHTML = `第 ${this.questionsCount} 問 <span class="difficulty-badge ${diffInfo.class}">${diffInfo.label}</span>`;
        this.progressBar.style.width = `${(this.questionsCount / this.maxQuestions) * 100}%`;

        // 出題プールを取得
        const pool = this.getCurrentPool();

        // 正解の国を選択
        let correctCountry;
        let attempts = 0;
        do {
            const randomIndex = Math.floor(Math.random() * pool.length);
            correctCountry = pool[randomIndex];
            attempts++;
        } while (this.usedIndices.has(correctCountry.name) && attempts < 50); // 50回試行しても見つからなければ諦める（無限ループ防止）

        this.usedIndices.add(correctCountry.name);
        this.currentQuestion = correctCountry;

        // 選択肢を作成（正解1つ + 全データからランダムに3つ）
        const options = [correctCountry];
        while (options.length < 4) {
            const randomWrongIndex = Math.floor(Math.random() * this.countries.length);
            const wrongCountry = this.countries[randomWrongIndex];

            // 重複を避ける
            if (!options.some(o => o.name === wrongCountry.name)) {
                options.push(wrongCountry);
            }
        }

        // 選択肢をシャッフル
        this.shuffle(options);

        // UIの更新
        this.flagImage.src = correctCountry.flag;
        this.flagImage.alt = "国旗";

        this.optionsContainer.innerHTML = '';
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option.name;
            button.addEventListener('click', () => this.handleAnswer(button, option.name === correctCountry.name));
            this.optionsContainer.appendChild(button);
        });
    }

    handleAnswer(selectedButton, isCorrect) {
        const buttons = this.optionsContainer.querySelectorAll('.option-btn');
        buttons.forEach(btn => btn.style.pointerEvents = 'none');

        const feedbackOverlay = document.getElementById('feedback');
        const feedbackIcon = document.getElementById('feedback-icon');
        const feedbackText = document.getElementById('feedback-text');

        const feedbackDetails = document.getElementById('feedback-details');

        if (isCorrect) {
            this.playSound('correct');
            selectedButton.classList.add('correct');
            this.score += 10;
            this.updateScoreDisplay();
            feedbackIcon.textContent = '';
            feedbackText.textContent = '〇'; // 大正解から〇に変更
            feedbackText.style.color = '#ef4444'; // 日本式（赤）に変更
            feedbackText.style.fontSize = '8rem'; // でかくする
            feedbackDetails.style.display = 'none'; // 正解時は詳細を隠す
            feedbackOverlay.classList.remove('interactive'); // タップ待ちはしない

            feedbackOverlay.classList.add('active');
            setTimeout(() => {
                feedbackOverlay.classList.remove('active');
                feedbackText.style.fontSize = ''; // 復元
                this.nextQuestion();
            }, 1000); // すこし短くしてテンポアップ

        } else {
            this.playSound('wrong');
            selectedButton.classList.add('wrong');
            feedbackIcon.textContent = '';
            feedbackText.textContent = '✖'; // 残念から✖に変更
            feedbackText.style.color = '#3b82f6'; // 青に変更
            feedbackText.style.fontSize = '8rem';

            // 不正解時は正解の国旗と国名を表示してタップ待ちにする
            feedbackDetails.innerHTML = `
                <div class="correct-answer-info">
                    <p style="font-size: 1rem; color: #fff; margin-bottom: 8px;">せいかいは…</p>
                    <img src="${this.currentQuestion.flag}" alt="正解の国旗" class="feedback-flag">
                    <p style="font-size: 1.5rem; color: #fff; font-weight: bold;">${this.currentQuestion.name}</p>
                    <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 12px; animation: blink 1.5s infinite;">タップして次へ ➡</p>
                </div>
            `;
            feedbackDetails.style.display = 'block';

            // 正解のボタンをハイライト
            buttons.forEach(btn => {
                if (btn.textContent === this.currentQuestion.name) {
                    btn.classList.add('correct');
                }
            });

            // タップしてから次に進む処理
            feedbackOverlay.classList.add('active');
            feedbackOverlay.classList.add('interactive'); // CSSでポインターイベントを有効化するため

            const advanceQuiz = () => {
                feedbackOverlay.classList.remove('active');
                feedbackOverlay.classList.remove('interactive');
                feedbackOverlay.removeEventListener('click', advanceQuiz);
                feedbackText.style.fontSize = ''; // 復元
                this.nextQuestion();
            };

            // 少しだけ遅延させてからクリックイベントを登録（誤爆防止）
            setTimeout(() => {
                feedbackOverlay.addEventListener('click', advanceQuiz);
            }, 500);
        }
    }

    endGame() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('flagQuizHighScore', this.highScore);
            this.updateHighScoreDisplay();
        }

        // 100点（満点）だったら回数を記録
        if (this.score === (this.maxQuestions * 10)) {
            this.perfectCount++;
            localStorage.setItem('flagQuizPerfectCount', this.perfectCount);
        }

        this.finalScoreDisplay.textContent = this.score;
        // 「正解数：7/10」の表示はHTMLから削除するため、ここでの更新処理も削除
        this.showScreen('result');
    }

    // Utilities
    showScreen(screenId) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.screens[screenId].classList.add('active');
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.remove('hidden');
        } else {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    updateScoreDisplay() {
        this.currentScoreDisplay.textContent = this.score;
    }

    updateHighScoreDisplay() {
        this.highScoreDisplay.textContent = this.highScore;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 背景に国旗を運動会のように上下に並べる
    spawnBackgroundFlags() {
        const container = document.getElementById('bg-flags');
        if (!container || this.countries.length === 0) return;

        // 国旗をシャッフルして上段・下段に分割
        const shuffled = [...this.countries].sort(() => Math.random() - 0.5);

        // 上段ラベルと下段ラベルのdivを作成
        const rowTop = document.createElement('div');
        rowTop.className = 'row-top';

        const rowBottom = document.createElement('div');
        rowBottom.className = 'row-bottom';

        // 画面横幅に十分な数（余裕を持って40枚）を配置
        const count = Math.min(shuffled.length, 40);
        const half = Math.ceil(count / 2);

        for (let i = 0; i < count; i++) {
            const country = shuffled[i % shuffled.length];
            const img = document.createElement('img');
            img.src = country.flag;
            img.alt = country.name;
            img.className = 'bg-flag-item';
            img.title = country.name;

            if (i < half) {
                rowTop.appendChild(img);
            } else {
                rowBottom.appendChild(img);
            }
        }

        container.appendChild(rowTop);
        container.appendChild(rowBottom);
    }
}

// アプリの起動
window.addEventListener('DOMContentLoaded', () => {
    new FlagQuizGame();
});
