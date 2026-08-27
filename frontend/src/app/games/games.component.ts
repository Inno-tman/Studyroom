import { Component, OnDestroy } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

type GameId = 'math' | 'scramble' | 'quiz' | null;

interface GameMeta {
  id: Exclude<GameId, null>;
  icon: string;
  title: string;
  desc: string;
  color: string;
}

interface TriviaQuestion {
  q: string;
  options: string[];
  answer: number;
  category: string;
}

const SCRAMBLE_WORDS = [
  'focus', 'memorize', 'quantum', 'equation', 'biology', 'grammar', 'history',
  'geometry', 'vocabulary', 'discipline', 'syllabus', 'annotate', 'revision',
  'deadline', 'notebook', 'scholar', 'library', 'curriculum', 'essay', 'formula'
];

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { q: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'], answer: 1, category: 'Biology' },
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], answer: 2, category: 'Astronomy' },
  { q: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Au', 'Gd'], answer: 2, category: 'Chemistry' },
  { q: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], answer: 1, category: 'Literature' },
  { q: 'What is the square root of 144?', options: ['10', '12', '14', '16'], answer: 1, category: 'Math' },
  { q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3, category: 'Geography' },
  { q: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], answer: 2, category: 'Geography' },
  { q: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], answer: 1, category: 'Biology' },
  { q: 'Which language has the most native speakers worldwide?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], answer: 2, category: 'Language' },
  { q: 'Who is considered the father of modern physics?', options: ['Isaac Newton', 'Albert Einstein', 'Nikola Tesla', 'Galileo'], answer: 1, category: 'Physics' },
  { q: 'What is the capital of Japan?', options: ['Seoul', 'Beijing', 'Osaka', 'Tokyo'], answer: 3, category: 'Geography' },
  { q: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1, category: 'Math' },
  { q: 'Which element has the atomic number 1?', options: ['Helium', 'Oxygen', 'Hydrogen', 'Carbon'], answer: 2, category: 'Chemistry' },
  { q: 'In which year did World War I begin?', options: ['1912', '1914', '1916', '1918'], answer: 1, category: 'History' },
  { q: 'What is the largest organ of the human body?', options: ['Liver', 'Brain', 'Skin', 'Heart'], answer: 2, category: 'Biology' },
  { q: 'What does "HTTP" stand for in web addresses?', options: ['HyperText Transfer Protocol', 'High Transfer Text Process', 'HyperType Transfer Portal', 'Home Text Transfer Protocol'], answer: 0, category: 'Technology' },
  { q: 'Which instrument has 88 keys?', options: ['Violin', 'Guitar', 'Piano', 'Flute'], answer: 2, category: 'Music' },
  { q: 'What is the study of weather called?', options: ['Geology', 'Meteorology', 'Astronomy', 'Ecology'], answer: 1, category: 'Science' },
  { q: 'Which blood type is known as the universal donor?', options: ['A', 'B', 'AB', 'O'], answer: 3, category: 'Biology' },
  { q: 'How many bones are in the adult human body?', options: ['106', '206', '306', '186'], answer: 1, category: 'Biology' }
];

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <div class="games-page">
      <div class="page-header">
        <h1>Educational Games</h1>
        <p class="page-subtitle">Sharpen your mind between study sessions. Scores are saved locally.</p>
      </div>

      <!-- Hub -->
      <ng-container *ngIf="selected === null">
        <div class="games-grid">
          <button *ngFor="let game of games" class="game-card" (click)="open(game.id)">
            <div class="game-icon" [style.background]="game.color">
              <span class="material-icons">{{ game.icon }}</span>
            </div>
            <div class="game-info">
              <span class="game-title">{{ game.title }}</span>
              <span class="game-desc">{{ game.desc }}</span>
            </div>
            <div class="game-best">
              <span *ngIf="bestScore(game.id) > 0" class="best-label">
                Best: <strong>{{ bestScore(game.id) }}</strong>
              </span>
              <span *ngIf="bestScore(game.id) === 0" class="best-label new">Not played yet</span>
              <span class="material-icons play">play_circle_fill</span>
            </div>
          </button>
        </div>

        <div class="card tip-card">
          <div class="tip-icon"><span class="material-icons">lightbulb</span></div>
          <div>
            <h3>Study tip</h3>
            <p>Short, active recall games work great as a warm-up or a reward during a Pomodoro break.</p>
          </div>
        </div>
      </ng-container>

      <!-- Quick Math -->
      <ng-container *ngIf="selected === 'math'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Quick Math</div>
            <div class="score-pill">{{ mathScore }}</div>
          </div>

          <div class="hud" *ngIf="mathRunning">
            <div class="timer" [class.low]="mathTimeLeft <= 10">
              <span class="material-icons">timer</span> {{ mathTimeLeft }}s
            </div>
            <div class="level">{{ mathStreak >= 4 ? 'On fire!' : 'Keep going' }} (streak {{ mathStreak }})</div>
          </div>

          <div *ngIf="mathRunning" class="math-problem">
            <span>{{ mathA }}</span>
            <span class="op">{{ mathOp }}</span>
            <span>{{ mathB }}</span>
            <span class="eq">=</span>
            <input
              #mathInput
              type="number"
              [(ngModel)]="mathAnswer"
              (keydown.enter)="submitMath()"
              placeholder="?"
              autofocus
            />
          </div>

          <div *ngIf="!mathRunning" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ mathScore }}</strong>
              <span>points</span>
            </div>
            <p *ngIf="isNewBest('math')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startMath()">Play again</button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Word Scramble -->
      <ng-container *ngIf="selected === 'scramble'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Word Scramble</div>
            <div class="score-pill">{{ scrambleScore }}</div>
          </div>

          <div class="hud" *ngIf="scrambleRunning">
            <div class="round" *ngIf="!scrambleFinished">
              Round {{ scrambleRound + 1 }} / {{ scrambleTotal }}
            </div>
            <div class="level" *ngIf="!scrambleFinished">Hint: {{ scrambleHint }}</div>
          </div>

          <div *ngIf="scrambleRunning && !scrambleFinished" class="scramble-scene">
            <div class="scrambled-word">{{ scrambleDisplay }}</div>
            <div class="scramble-input">
              <input
                #scrambleInput
                type="text"
                [(ngModel)]="scrambleGuess"
                (keydown.enter)="submitScramble()"
                placeholder="Type the word…"
                [class.wrong]="scrambleWrong"
              />
              <button class="btn-primary" (click)="submitScramble()">Check</button>
            </div>
            <p class="scramble-feedback" [class.correct]="scrambleFeedbackOk">
              {{ scrambleFeedback }}
            </p>
          </div>

          <div *ngIf="!scrambleRunning || scrambleFinished" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ scrambleScore }}</strong>
              <span>{{ scrambleFinished ? ' points' : ' points — start when ready' }}</span>
            </div>
            <p *ngIf="scrambleFinished && isNewBest('scramble')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startScramble()">
                {{ scrambleFinished ? 'Play again' : 'Start' }}
              </button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Trivia Quiz -->
      <ng-container *ngIf="selected === 'quiz'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Trivia Quiz</div>
            <div class="score-pill">{{ quizScore }}</div>
          </div>

          <div class="hud" *ngIf="quizRunning && !quizFinished">
            <div class="round">
              Question {{ quizIndex + 1 }} / {{ quizQuestions.length }}
              <span class="category">{{ quizQuestions[quizIndex]?.category }}</span>
            </div>
          </div>

          <div *ngIf="quizRunning && !quizFinished" class="quiz-scene">
            <h3 class="quiz-question">{{ quizQuestions[quizIndex]?.q }}</h3>
            <div class="quiz-options">
              <button
                *ngFor="let opt of quizQuestions[quizIndex]?.options; let i = index"
                class="quiz-option"
                [class.selected]="quizSelected === i"
                [class.correct]="quizAnswered && i === quizQuestions[quizIndex]?.answer"
                [class.wrong]="quizAnswered && quizSelected === i && i !== quizQuestions[quizIndex]?.answer"
                [disabled]="quizAnswered"
                (click)="answerQuiz(i)"
              >
                <span class="option-letter">{{ letters[i] }}</span> {{ opt }}
              </button>
            </div>
            <div *ngIf="quizAnswered" class="quiz-feedback">
              <span [class.correct]="quizLastCorrect" [class.wrong]="!quizLastCorrect">
                {{ quizLastCorrect ? 'Correct!' : 'Not quite.' }}
              </span>
              <button class="btn-primary" (click)="nextQuiz()">
                {{ quizIndex + 1 >= quizQuestions.length ? 'See results' : 'Next' }}
              </button>
            </div>
          </div>

          <div *ngIf="!quizRunning || quizFinished" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ quizScore }}</strong>
              <span>of {{ quizQuestions.length }} correct</span>
            </div>
            <p *ngIf="quizFinished && isNewBest('quiz')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startQuiz()">
                {{ quizFinished ? 'Play again' : 'Start' }}
              </button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .games-page { max-width: 820px; margin: 0 auto; }

    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: var(--font-24); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .page-subtitle { font-size: var(--font-14); color: var(--text-secondary); }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .game-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      text-align: left;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .game-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .game-icon {
      width: 46px; height: 46px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: white;
    }
    .game-icon .material-icons { font-size: var(--font-24); }

    .game-info { display: flex; flex-direction: column; gap: 4px; }
    .game-title { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); }
    .game-desc { font-size: var(--font-13); color: var(--text-secondary); line-height: 1.45; }

    .game-best {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 2px;
    }
    .best-label { font-size: var(--font-12); color: var(--text-muted); }
    .best-label strong { color: var(--accent); }
    .best-label.new { color: var(--text-muted); }
    .play { color: var(--primary); font-size: var(--font-22); }

    .tip-card {
      display: flex; gap: 14px; align-items: flex-start;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .tip-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
    }
    .tip-card h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); margin: 0 0 4px; }
    .tip-card p { font-size: var(--font-13); color: var(--text-secondary); margin: 0; line-height: 1.5; }

    .game-window { padding: 24px; }
    .game-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .game-head .back {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px;
    }
    .game-head .game-title { font-size: var(--font-18); font-weight: 700; color: var(--text-primary); margin-right: auto; }
    .score-pill {
      font-size: var(--font-16); font-weight: 700; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      padding: 6px 16px; border-radius: 20px;
    }

    .hud { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
    .timer {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: var(--font-15); font-weight: 700; color: var(--text-primary);
      background: var(--background); border: 1px solid var(--border);
      padding: 6px 14px; border-radius: 20px;
    }
    .timer.low { color: #ef4444; border-color: #ef4444; }
    .round { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .category {
      font-size: var(--font-11); font-weight: 600; color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      border-radius: 10px; padding: 2px 8px; margin-left: 8px;
    }
    .level { font-size: var(--font-13); color: var(--text-secondary); }

    .math-problem {
      display: flex; align-items: center; justify-content: center; gap: 16px;
      flex-wrap: wrap;
      font-size: var(--font-40); font-weight: 800; color: var(--text-primary);
      padding: 32px 8px;
    }
    .math-problem .op { color: var(--accent); }
    .math-problem .eq { color: var(--text-muted); }
    .math-problem input {
      width: 110px;
      font-size: var(--font-36); font-weight: 800; text-align: center;
      background: var(--background); border: 2px solid var(--border);
      border-radius: 12px; color: var(--text-primary);
      padding: 8px 4px;
    }
    .math-problem input:focus { outline: none; border-color: var(--primary); }

    .scramble-scene { text-align: center; padding: 16px 4px; }
    .scrambled-word {
      font-size: var(--font-34); font-weight: 800; letter-spacing: 0.12em;
      color: var(--primary); margin-bottom: 24px;
      user-select: none;
    }
    .scramble-input {
      display: flex; gap: 10px; justify-content: center; align-items: center;
      flex-wrap: wrap;
    }
    .scramble-input input {
      width: 260px; padding: 12px 14px;
      font-size: var(--font-18); text-align: center;
      background: var(--background); border: 2px solid var(--border);
      border-radius: 10px; color: var(--text-primary);
    }
    .scramble-input input:focus { outline: none; border-color: var(--primary); }
    .scramble-input input.wrong { border-color: #ef4444; }
    .scramble-feedback { font-size: var(--font-14); color: #ef4444; font-weight: 600; min-height: 20px; margin: 14px 0 0; }
    .scramble-feedback.correct { color: var(--success); }

    .quiz-scene { padding: 8px 4px; }
    .quiz-question { font-size: var(--font-20); font-weight: 700; color: var(--text-primary); margin: 0 0 20px; line-height: 1.4; }
    .quiz-options { display: flex; flex-direction: column; gap: 10px; }
    .quiz-option {
      display: flex; align-items: center; gap: 12px;
      text-align: left;
      background: var(--background); border: 2px solid var(--border);
      border-radius: 10px; padding: 12px 14px;
      font-size: var(--font-15); color: var(--text-primary); font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
    }
    .quiz-option:hover:not(:disabled) { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, transparent); }
    .quiz-option:disabled { cursor: default; opacity: 0.7; }
    .quiz-option.selected { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
    .quiz-option.correct { border-color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); opacity: 1; }
    .quiz-option.wrong { border-color: #ef4444; background: color-mix(in srgb, #ef4444 14%, transparent); opacity: 1; }
    .option-letter {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-13); font-weight: 700; color: var(--text-secondary);
    }
    .quiz-option.correct .option-letter { background: var(--success); color: white; border-color: var(--success); }
    .quiz-option.wrong .option-letter { background: #ef4444; color: white; border-color: #ef4444; }

    .quiz-feedback {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      margin-top: 18px;
    }
    .quiz-feedback span { font-size: var(--font-16); font-weight: 700; }
    .quiz-feedback .correct { color: var(--success); }
    .quiz-feedback .wrong { color: #ef4444; }

    .game-over { text-align: center; padding: 28px 8px 16px; }
    .final-score {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      font-size: var(--font-18); color: var(--text-primary); margin-bottom: 8px;
    }
    .final-score .material-icons { font-size: var(--font-30); color: var(--accent); }
    .final-score strong { font-size: var(--font-40); font-weight: 800; color: var(--text-primary); }
    .new-best {
      font-size: var(--font-14); font-weight: 700; color: var(--success);
      margin: 0 0 18px;
    }
    .game-over-actions { display: flex; gap: 12px; justify-content: center; margin-top: 8px; }
  `]
})
export class GamesComponent implements OnDestroy {
  games: GameMeta[] = [
    { id: 'math', icon: 'calculate', title: 'Quick Math', desc: 'Solve as many arithmetic problems as you can in 60 seconds.', color: '#6366f1' },
    { id: 'scramble', icon: 'abc', title: 'Word Scramble', desc: 'Unscramble study-themed words fast. 20 rounds.', color: '#10b981' },
    { id: 'quiz', icon: 'quiz', title: 'Trivia Quiz', desc: '20 general-knowledge questions across science, history, math and more.', color: '#f59e0b' }
  ];
  letters = ['A', 'B', 'C', 'D'];

  selected: GameId = null;

  // Math
  mathRunning = false;
  mathScore = 0;
  mathStreak = 0;
  mathTimeLeft = 60;
  mathA = 0;
  mathB = 0;
  mathOp = '+';
  mathAnswer: number | null = null;
  private mathTimer?: any;

  // Scramble
  scrambleRunning = false;
  scrambleFinished = false;
  scrambleScore = 0;
  scrambleRound = 0;
  scrambleWord = '';
  scrambleDisplay = '';
  scrambleHint = '';
  scrambleGuess = '';
  scrambleFeedback = '';
  scrambleFeedbackOk = false;
  scrambleWrong = false;
  private scrambleWords: string[] = [];

  // Quiz
  quizRunning = false;
  quizFinished = false;
  quizScore = 0;
  quizIndex = 0;
  quizSelected: number | null = null;
  quizAnswered = false;
  quizLastCorrect = false;
  quizQuestions: TriviaQuestion[] = [];

  private bestKey = 'studyroom_games_best';
  scrambleTotal = SCRAMBLE_WORDS.length;

  constructor() {
    this.shuffleQuiz();
  }

  ngOnDestroy(): void {
    if (this.mathTimer) clearInterval(this.mathTimer);
  }

  open(id: Exclude<GameId, null>): void {
    this.selected = id;
  }

  back(): void {
    if (this.mathTimer) clearInterval(this.mathTimer);
    this.selected = null;
  }

  // ---------- Quick Math ----------
  startMath(): void {
    this.mathScore = 0;
    this.mathStreak = 0;
    this.mathTimeLeft = 60;
    this.mathRunning = true;
    this.nextMathQuestion();
    if (this.mathTimer) clearInterval(this.mathTimer);
    this.mathTimer = setInterval(() => {
      this.mathTimeLeft -= 1;
      if (this.mathTimeLeft <= 0) {
        clearInterval(this.mathTimer);
        this.mathTimer = undefined;
        this.mathRunning = false;
        this.recordBest('math', this.mathScore);
      }
    }, 1000);
  }

  nextMathQuestion(): void {
    const max = 10 + Math.floor(this.mathScore / 25) * 5;
    this.mathOp = Math.random() < 0.6 ? '+' : Math.random() < 0.5 ? '-' : '×';
    this.mathA = Math.floor(Math.random() * max) + 1;
    this.mathB = Math.floor(Math.random() * Math.max(2, max / 2)) + 1;
    if (this.mathOp === '-' && this.mathB > this.mathA) {
      [this.mathA, this.mathB] = [this.mathB, this.mathA];
    }
    this.mathAnswer = null;
  }

  submitMath(): void {
    if (!this.mathRunning) return;
    const answer = Number(this.mathAnswer);
    if (this.mathAnswer === null || isNaN(answer)) return;
    const expected = this.mathOp === '+' ? this.mathA + this.mathB : this.mathOp === '-' ? this.mathA - this.mathB : this.mathA * this.mathB;
    if (answer === expected) {
      this.mathStreak += 1;
      const bonus = this.mathTimeLeft >= 50 ? 15 : 10;
      this.mathScore += bonus;
      this.nextMathQuestion();
    } else {
      this.mathStreak = 0;
      this.nextMathQuestion();
    }
  }

  // ---------- Word Scramble ----------
  startScramble(): void {
    this.scrambleRunning = true;
    this.scrambleFinished = false;
    this.scrambleScore = 0;
    this.scrambleRound = 0;
    this.scrambleWords = [...SCRAMBLE_WORDS].sort(() => Math.random() - 0.5);
    this.loadScrambleRound();
  }

  loadScrambleRound(): void {
    if (this.scrambleRound >= this.scrambleWords.length) {
      this.scrambleRunning = false;
      this.scrambleFinished = true;
      this.recordBest('scramble', this.scrambleScore);
      return;
    }
    this.scrambleWord = this.scrambleWords[this.scrambleRound];
    this.scrambleHint = this.scrambleWord.charAt(0).toUpperCase() + '···' + this.scrambleWord.charAt(this.scrambleWord.length - 1);
    this.scrambleDisplay = this.shuffleLetters(this.scrambleWord);
    this.scrambleGuess = '';
    this.scrambleFeedback = '';
    this.scrambleFeedbackOk = false;
    this.scrambleWrong = false;
  }

  shuffleLetters(word: string): string {
    let arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  submitScramble(): void {
    if (!this.scrambleRunning || this.scrambleFinished) return;
    if (!this.scrambleGuess.trim()) return;
    const ok = this.scrambleGuess.trim().toLowerCase() === this.scrambleWord.toLowerCase();
    if (ok) {
      const timeBonus = 30 - this.scrambleRound * 1;
      this.scrambleScore += 10 + Math.max(0, timeBonus);
      this.scrambleFeedback = 'Correct! +' + (10 + Math.max(0, timeBonus)) + ' points';
      this.scrambleFeedbackOk = true;
      this.scrambleWrong = false;
      this.scrambleRound += 1;
      setTimeout(() => this.loadScrambleRound(), 650);
    } else {
      this.scrambleWrong = true;
      this.scrambleFeedback = 'Not quite — try again.';
      this.scrambleFeedbackOk = false;
    }
  }

  // ---------- Trivia Quiz ----------
  shuffleQuiz(): void {
    this.quizQuestions = [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
  }

  startQuiz(): void {
    this.shuffleQuiz();
    this.quizRunning = true;
    this.quizFinished = false;
    this.quizScore = 0;
    this.quizIndex = 0;
    this.quizSelected = null;
    this.quizAnswered = false;
  }

  answerQuiz(i: number): void {
    if (this.quizAnswered) return;
    this.quizSelected = i;
    this.quizAnswered = true;
    const correct = i === this.quizQuestions[this.quizIndex].answer;
    this.quizLastCorrect = correct;
    if (correct) this.quizScore += 1;
  }

  nextQuiz(): void {
    if (this.quizIndex + 1 >= this.quizQuestions.length) {
      this.quizRunning = false;
      this.quizFinished = true;
      this.recordBest('quiz', this.quizScore);
      return;
    }
    this.quizIndex += 1;
    this.quizSelected = null;
    this.quizAnswered = false;
  }

  // ---------- High scores ----------
  bestScore(id: Exclude<GameId, null>): number {
    try {
      const all = JSON.parse(localStorage.getItem(this.bestKey) || '{}') as Record<string, number>;
      return all[id] || 0;
    } catch {
      return 0;
    }
  }

  isNewBest(id: Exclude<GameId, null>): boolean {
    return this.hadNewBest === id;
  }

  private hadNewBest: Exclude<GameId, null> | null = null;

  private recordBest(id: Exclude<GameId, null>, score: number): void {
    try {
      const all = JSON.parse(localStorage.getItem(this.bestKey) || '{}') as Record<string, number>;
      if (score > (all[id] || 0)) {
        all[id] = score;
        localStorage.setItem(this.bestKey, JSON.stringify(all));
        this.hadNewBest = id;
      } else {
        this.hadNewBest = null;
      }
    } catch {
      this.hadNewBest = null;
    }
  }
}