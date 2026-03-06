/**
 * 世界の国旗クイズ - Game Logic
 */

class FlagQuizGame {
    constructor() {
        this.countries = [];
        this.currentQuestion = null;
        this.questionsCount = 0;
        this.score = 0;
        this.maxQuestions = 10;
        this.usedIndices = new Set();
        this.highScore = localStorage.getItem('flagQuizHighScore') || 0;

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

            console.log(`${this.countries.length} か国のデータを読み込みました。`);
        } catch (error) {
            console.error('データ取得エラー:', error);
            alert('国旗データの取得に失敗しました。ページを再読み込みしてください。');
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

    nextQuestion() {
        if (this.questionsCount >= this.maxQuestions) {
            this.endGame();
            return;
        }

        this.questionsCount++;
        this.questionNumberDisplay.textContent = `第 ${this.questionsCount} 問`;
        this.progressBar.style.width = `${(this.questionsCount / this.maxQuestions) * 100}%`;

        // 正解の国を選択
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * this.countries.length);
        } while (this.usedIndices.has(randomIndex));

        this.usedIndices.add(randomIndex);
        const correctCountry = this.countries[randomIndex];
        this.currentQuestion = correctCountry;

        // 選択肢を作成（正解1つ + 不正解3つ）
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
        this.flagImage.alt = "国旗クイズの画像";

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
