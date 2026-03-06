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

        // 有名な国の定義（日本語名でマッチング）
        this.famousCountries = {
            lv1: ["日本", "アメリカ", "中国", "フランス", "イタリア", "ドイツ", "イギリス", "韓国", "ブラジル", "カナダ", "スペイン"],
            lv2: ["オーストラリア", "インド", "エジプト", "タイ", "スイス", "ロシア", "メキシコ", "シンガポール", "ポルトガル", "オランダ"],
            lv3: ["アルゼンチン", "トルコ", "ギリシャ", "スウェーデン", "ベトナム", "インドネシア", "フィリピン", "フィンランド", "南アフリカ", "ベルギー"]
        };

        // UI Elements
        this.screens = {
            menu: document.getElementById('menu-screen'),
            quiz: document.getElementById('quiz-screen'),
            result: document.getElementById('result-screen')
        };
        this.loadingOverlay = document.getElementById('loading-overlay');

        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');

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
        this.attachEventListeners();
        await this.loadCountryData();
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.startGame());
        this.backToMenuBtn.addEventListener('click', () => this.showScreen('menu'));
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
                const commonName = country.translations?.jpn?.common || country.name.common;
                return {
                    name: commonName,
                    flag: country.flags.svg || country.flags.png
                };
            }).filter(c => c.name && c.flag);

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
        } catch (error) {
            console.error('データ取得エラー:', error);
            alert('国旗データの取得に失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    startGame() {
        this.score = 0;
        this.questionsCount = 0;
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
        if (this.questionsCount >= this.maxQuestions) {
            this.endGame();
            return;
        }

        this.questionsCount++;
        const diffInfo = this.getDifficultyInfo();
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
        // すべてのボタンを無効化
        const buttons = this.optionsContainer.querySelectorAll('.option-btn');
        buttons.forEach(btn => btn.style.pointerEvents = 'none');

        const feedbackOverlay = document.getElementById('feedback');
        const feedbackIcon = document.getElementById('feedback-icon');
        const feedbackText = document.getElementById('feedback-text');

        if (isCorrect) {
            selectedButton.classList.add('correct');
            this.score += 10;
            this.updateScoreDisplay();
            feedbackIcon.textContent = '✅';
            feedbackText.textContent = '正解！';
            feedbackText.style.color = '#10b981';
        } else {
            selectedButton.classList.add('wrong');
            feedbackIcon.textContent = '❌';
            feedbackText.textContent = '残念...';
            feedbackText.style.color = '#ef4444';
            // 正解のボタンをハイライト
            buttons.forEach(btn => {
                if (btn.textContent === this.currentQuestion.name) {
                    btn.classList.add('correct');
                }
            });
        }

        feedbackOverlay.classList.add('active');

        // 次の問題へ（少し待機）
        setTimeout(() => {
            feedbackOverlay.classList.remove('active');
            this.nextQuestion();
        }, 1200);
    }

    endGame() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('flagQuizHighScore', this.highScore);
            this.updateHighScoreDisplay();
        }

        this.finalScoreDisplay.textContent = this.score;
        document.getElementById('correct-count').textContent = `${this.score / 10} / ${this.maxQuestions}`;
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
}

// アプリの起動
window.addEventListener('DOMContentLoaded', () => {
    new FlagQuizGame();
});
