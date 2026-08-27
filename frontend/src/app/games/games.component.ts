import { Component, OnDestroy } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

type GameId = 'math' | 'scramble' | 'quiz' | 'memory' | 'truefalse' | 'flags' | 'elements' | null;

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

interface MemoryCard {
  id: number;
  pairId: number;
  text: string;
  flipped: boolean;
  matched: boolean;
}

interface FlagEntry {
  flag: string;
  country: string;
}

interface ElementEntry {
  name: string;
  symbol: string;
}

const MEMORY_PAIRS = [
  { term: 'Photosynthesis', def: 'How plants turn sunlight into energy' },
  { term: 'Mitochondria', def: 'The powerhouse of the cell' },
  { term: 'Hypotenuse', def: 'Longest side of a right triangle' },
  { term: 'Axiom', def: 'A statement accepted as true without proof' },
  { term: 'Osmosis', def: 'Water diffusing through a membrane' },
  { term: 'Prime number', def: 'Divisible only by 1 and itself' },
  { term: 'Ecosystem', def: 'A community of life and its environment' },
  { term: 'Gravity', def: 'The force that pulls objects toward each other' },
  { term: 'Molecule', def: 'Two or more atoms bonded together' },
  { term: 'Metaphor', def: 'A figure of speech comparing two things' },
  { term: 'Velocity', def: 'Speed with a direction attached' },
  { term: 'Syllabus', def: 'An outline of what a course covers' }
];

const TRUE_FALSE_BANK = [
  { text: 'The Earth revolves around the Sun.', isTrue: true },
  { text: 'Water boils at 100°C at sea level.', isTrue: true },
  { text: 'Sharks are mammals.', isTrue: false },
  { text: 'Mount Everest is the tallest mountain above sea level.', isTrue: true },
  { text: 'Lightning is hotter than the surface of the Sun.', isTrue: true },
  { text: 'The human body has 206 bones.', isTrue: true },
  { text: 'Venus is the closest planet to the Sun.', isTrue: false },
  { text: 'Einstein won a Nobel Prize for the Theory of Relativity.', isTrue: false },
  { text: 'A year on Mars is longer than a year on Earth.', isTrue: true },
  { text: 'Sound travels faster in water than in air.', isTrue: true },
  { text: 'Tomatoes are technically a fruit.', isTrue: true },
  { text: 'Octopuses have three hearts.', isTrue: true },
  { text: 'Bats are blind.', isTrue: false },
  { text: 'The Nile is the longest river in the world.', isTrue: true },
  { text: 'A group of lions is called a pride.', isTrue: true },
  { text: 'Freezing point of water is 0°C.', isTrue: true },
  { text: 'Human blood is blue inside the body.', isTrue: false },
  { text: 'The Great Wall of China is visible from space with the naked eye.', isTrue: false },
  { text: 'Mercury is the closest planet to the Sun.', isTrue: true },
  { text: 'Dolphins are fish.', isTrue: false }
];

const FLAG_BANK: FlagEntry[] = [
  { flag: '🇯🇵', country: 'Japan' },
  { flag: '🇫🇷', country: 'France' },
  { flag: '🇧🇷', country: 'Brazil' },
  { flag: '🇨🇦', country: 'Canada' },
  { flag: '🇦🇺', country: 'Australia' },
  { flag: '🇪🇸', country: 'Spain' },
  { flag: '🇮🇹', country: 'Italy' },
  { flag: '🇩🇪', country: 'Germany' },
  { flag: '🇮🇳', country: 'India' },
  { flag: '🇲🇽', country: 'Mexico' },
  { flag: '🇿🇦', country: 'South Africa' },
  { flag: '🇰🇷', country: 'South Korea' },
  { flag: '🇬🇧', country: 'United Kingdom' },
  { flag: '🇺🇸', country: 'United States' },
  { flag: '🇪🇬', country: 'Egypt' },
  { flag: '🇸🇪', country: 'Sweden' },
  { flag: '🇨🇳', country: 'China' },
  { flag: '🇷🇺', country: 'Russia' },
  { flag: '🇳🇱', country: 'Netherlands' },
  { flag: '🇹🇷', country: 'Turkey' }
];

const ELEMENT_BANK: ElementEntry[] = [
  { name: 'Hydrogen', symbol: 'H' },
  { name: 'Helium', symbol: 'He' },
  { name: 'Lithium', symbol: 'Li' },
  { name: 'Carbon', symbol: 'C' },
  { name: 'Nitrogen', symbol: 'N' },
  { name: 'Oxygen', symbol: 'O' },
  { name: 'Sodium', symbol: 'Na' },
  { name: 'Magnesium', symbol: 'Mg' },
  { name: 'Aluminium', symbol: 'Al' },
  { name: 'Silicon', symbol: 'Si' },
  { name: 'Sulfur', symbol: 'S' },
  { name: 'Chlorine', symbol: 'Cl' },
  { name: 'Potassium', symbol: 'K' },
  { name: 'Calcium', symbol: 'Ca' },
  { name: 'Iron', symbol: 'Fe' },
  { name: 'Copper', symbol: 'Cu' },
  { name: 'Zinc', symbol: 'Zn' },
  { name: 'Silver', symbol: 'Ag' },
  { name: 'Tin', symbol: 'Sn' },
  { name: 'Gold', symbol: 'Au' },
  { name: 'Mercury', symbol: 'Hg' },
  { name: 'Lead', symbol: 'Pb' },
  { name: 'Argon', symbol: 'Ar' },
  { name: 'Neon', symbol: 'Ne' }
];

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

      <!-- Memory Match -->
      <ng-container *ngIf="selected === 'memory'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Memory Match</div>
            <div class="score-pill">{{ memoryScore || '—' }}</div>
          </div>

          <div class="hud" *ngIf="memoryRunning">
            <div class="round">Matched {{ memoryMatched }} / {{ memoryPairCount }}</div>
            <div class="level">{{ memoryMoves }} moves</div>
          </div>

          <div *ngIf="memoryRunning" class="memory-grid">
            <button
              *ngFor="let card of memoryCards; let i = index"
              class="memory-card"
              [class.flipped]="card.flipped"
              [class.matched]="card.matched"
              (click)="flipCard(i)"
            >
              <span *ngIf="!card.flipped" class="memory-back"><span class="material-icons">help</span></span>
              <span *ngIf="card.flipped" class="memory-face">{{ card.text }}</span>
            </button>
          </div>

          <div *ngIf="!memoryRunning" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ memoryScore }}</strong>
              <span>points</span>
            </div>
            <p *ngIf="memoryFinished" class="result-line">{{ memoryMoves }} moves this round.</p>
            <p *ngIf="memoryFinished && isNewBest('memory')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startMemory()">
                {{ memoryFinished ? 'Play again' : 'Start' }}
              </button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- True/False Sprint -->
      <ng-container *ngIf="selected === 'truefalse'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">True/False Sprint</div>
            <div class="score-pill">{{ tfScore }}</div>
          </div>

          <div class="hud" *ngIf="tfRunning">
            <div class="timer" [class.low]="tfTimeLeft <= 10">
              <span class="material-icons">timer</span> {{ tfTimeLeft }}s
            </div>
            <div class="level">{{ tfStreak >= 5 ? 'On fire!' : 'Streak ' + tfStreak }}</div>
          </div>

          <div *ngIf="tfRunning" class="truefalse-scene">
            <h3 class="quiz-question">{{ tfQuestion }}</h3>
            <div class="tf-actions">
              <button
                class="tf-btn tf-true"
                [class.flash-correct]="tfFeedback === 'correct' && tfLastAnswer === true"
                [class.flash-wrong]="tfFeedback === 'wrong' && tfLastAnswer === true"
                (click)="answerTrueFalse(true)"
              >
                <span class="material-icons">check</span> True
              </button>
              <button
                class="tf-btn tf-false"
                [class.flash-correct]="tfFeedback === 'correct' && tfLastAnswer === false"
                [class.flash-wrong]="tfFeedback === 'wrong' && tfLastAnswer === false"
                (click)="answerTrueFalse(false)"
              >
                <span class="material-icons">close</span> False
              </button>
            </div>
          </div>

          <div *ngIf="!tfRunning" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ tfScore }}</strong>
              <span>correct</span>
            </div>
            <p *ngIf="tfFinished && isNewBest('truefalse')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startTrueFalse()">
                {{ tfFinished ? 'Play again' : 'Start' }}
              </button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Flag Finder -->
      <ng-container *ngIf="selected === 'flags'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Flag Finder</div>
            <div class="score-pill">{{ flagsScore }}</div>
          </div>

          <div class="hud" *ngIf="flagsRunning && !flagsFinished">
            <div class="round">Flag {{ flagsIndex + 1 }} / {{ flagsRounds }}</div>
          </div>

          <div *ngIf="flagsRunning && !flagsFinished" class="quiz-scene">
            <div class="flag-big">{{ flagTarget }}</div>
            <div class="quiz-options">
              <button
                *ngFor="let o of flagsOptions; let i = index"
                class="quiz-option"
                [class.correct]="flagsAnswered && i === flagsCorrectIndex"
                [class.wrong]="flagsAnswered && flagsSelected === i && i !== flagsCorrectIndex"
                [disabled]="flagsAnswered"
                (click)="answerFlags(i)"
              >
                <span class="option-letter">{{ letters[i] }}</span> {{ o.country }}
              </button>
            </div>
            <div *ngIf="flagsAnswered" class="quiz-feedback">
              <span [class.correct]="flagsLastCorrect" [class.wrong]="!flagsLastCorrect">
                {{ flagsLastCorrect ? 'Correct! ' : '' }}It's {{ flagsCorrectCountry }}
              </span>
              <button class="btn-primary" (click)="nextFlags()">
                {{ flagsIndex + 1 >= flagsRounds ? 'See results' : 'Next' }}
              </button>
            </div>
          </div>

          <div *ngIf="!flagsRunning || flagsFinished" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ flagsScore }}</strong>
              <span>of {{ flagsRounds }} correct</span>
            </div>
            <p *ngIf="flagsFinished && isNewBest('flags')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startFlags()">
                {{ flagsFinished ? 'Play again' : 'Start' }}
              </button>
              <button class="btn-secondary" (click)="back()">Back to games</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Element Symbols -->
      <ng-container *ngIf="selected === 'elements'">
        <div class="card game-window">
          <div class="game-head">
            <button class="btn-secondary back" (click)="back()">
              <span class="material-icons">arrow_back</span> All games
            </button>
            <div class="game-title">Element Symbols</div>
            <div class="score-pill">{{ elementsScore }}</div>
          </div>

          <div class="hud" *ngIf="elementsRunning && !elementsFinished">
            <div class="round">Element {{ elementsIndex + 1 }} / {{ elementsRounds }}</div>
          </div>

          <div *ngIf="elementsRunning && !elementsFinished" class="quiz-scene">
            <h3 class="quiz-question">What is the symbol for <span class="element-name">{{ elementTarget }}</span>?</h3>
            <div class="quiz-options elements-options">
              <button
                *ngFor="let e of elementsOptions; let i = index"
                class="quiz-option"
                [class.correct]="elementsAnswered && i === elementsCorrectIndex"
                [class.wrong]="elementsAnswered && elementsSelected === i && i !== elementsCorrectIndex"
                [disabled]="elementsAnswered"
                (click)="answerElements(i)"
              >
                <span class="option-letter">{{ letters[i] }}</span>
                <span class="element-symbol">{{ e.symbol }}</span>
              </button>
            </div>
            <div *ngIf="elementsAnswered" class="quiz-feedback">
              <span [class.correct]="elementsLastCorrect" [class.wrong]="!elementsLastCorrect">
                {{ elementsLastCorrect ? 'Correct! ' : '' }}{{ elementCorrectName }} → {{ elementCorrectSymbol }}
              </span>
              <button class="btn-primary" (click)="nextElements()">
                {{ elementsIndex + 1 >= elementsRounds ? 'See results' : 'Next' }}
              </button>
            </div>
          </div>

          <div *ngIf="!elementsRunning || elementsFinished" class="game-over">
            <div class="final-score">
              <span class="material-icons">emoji_events</span>
              <strong>{{ elementsScore }}</strong>
              <span>of {{ elementsRounds }} correct</span>
            </div>
            <p *ngIf="elementsFinished && isNewBest('elements')" class="new-best">New personal best!</p>
            <div class="game-over-actions">
              <button class="btn-primary" (click)="startElements()">
                {{ elementsFinished ? 'Play again' : 'Start' }}
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
    .result-line { font-size: var(--font-14); color: var(--text-secondary); margin: 0 0 12px; }

    /* Memory Match */
    .memory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .memory-card {
      min-height: 84px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--background);
      color: var(--text-primary);
      font-size: var(--font-13);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 10px;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    .memory-card:hover:not(.flipped):not(.matched) { border-color: var(--primary); transform: translateY(-2px); }
    .memory-card.flipped { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .memory-card.matched {
      border-color: var(--success);
      background: color-mix(in srgb, var(--success) 12%, transparent);
      cursor: default;
      opacity: 0.9;
    }
    .memory-back .material-icons { font-size: var(--font-24); color: var(--text-muted); }

    /* True/False Sprint */
    .truefalse-scene { text-align: center; padding: 8px 4px; }
    .tf-actions { display: flex; gap: 14px; justify-content: center; }
    .tf-btn {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: var(--font-17); font-weight: 700;
      border-radius: 12px; padding: 14px 34px;
      border: 2px solid var(--border);
      background: var(--background);
      color: var(--text-primary);
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    .tf-btn:hover { transform: translateY(-2px); }
    .tf-true:hover { border-color: var(--success); }
    .tf-false:hover { border-color: #ef4444; }
    .tf-btn.flash-correct { border-color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
    .tf-btn.flash-wrong { border-color: #ef4444; background: color-mix(in srgb, #ef4444 15%, transparent); }
    .tf-true .material-icons { color: var(--success); }
    .tf-false .material-icons { color: #ef4444; }

    /* Flag Finder */
    .flag-big { font-size: 96px; text-align: center; margin: 0 0 22px; user-select: none; }

    /* Element Symbols */
    .element-name { color: var(--accent); }
    .element-symbol { font-size: var(--font-22); font-weight: 700; letter-spacing: 0.03em; }
    .elements-options .quiz-option { justify-content: center; }
  `]
})
export class GamesComponent implements OnDestroy {
  games: GameMeta[] = [
    { id: 'math', icon: 'calculate', title: 'Quick Math', desc: 'Solve as many arithmetic problems as you can in 60 seconds.', color: '#6366f1' },
    { id: 'scramble', icon: 'abc', title: 'Word Scramble', desc: 'Unscramble study-themed words fast. 20 rounds.', color: '#10b981' },
    { id: 'quiz', icon: 'quiz', title: 'Trivia Quiz', desc: '20 general-knowledge questions across science, history, math and more.', color: '#f59e0b' },
    { id: 'memory', icon: 'extension', title: 'Memory Match', desc: 'Flip cards and match study terms with their definitions. 6 pairs.', color: '#8b5cf6' },
    { id: 'truefalse', icon: 'thumbs_up_down', title: 'True/False Sprint', desc: 'Blast through 30 seconds of rapid fact checks.', color: '#ef4444' },
    { id: 'flags', icon: 'public', title: 'Flag Finder', desc: 'Identify countries from their flags. 10 rounds.', color: '#3b82f6' },
    { id: 'elements', icon: 'science', title: 'Element Symbols', desc: 'Match chemical elements to their symbols. 10 rounds.', color: '#14b8a6' }
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

  // Memory Match
  memoryRunning = false;
  memoryFinished = false;
  memoryCards: MemoryCard[] = [];
  memoryFirst: number | null = null;
  memoryMoves = 0;
  memoryLocked = false;
  memoryMatched = 0;
  memoryScore = 0;
  memoryPairCount = 6;
  private memoryFlipTimer?: any;

  // True/False Sprint
  tfRunning = false;
  tfFinished = false;
  tfScore = 0;
  tfStreak = 0;
  tfTimeLeft = 30;
  tfIndex = 0;
  tfQuestion = '';
  tfFeedback = '';
  tfLastAnswer = false;
  tfLocked = false;
  private tfBank: { text: string; isTrue: boolean }[] = [];
  private tfTimer?: any;
  private tfAdvanceTimer?: any;

  // Flag Finder
  flagsRunning = false;
  flagsFinished = false;
  flagsScore = 0;
  flagsIndex = 0;
  flagsRounds = 10;
  flagsOptions: FlagEntry[] = [];
  flagsCorrectIndex = 0;
  flagsSelected: number | null = null;
  flagsAnswered = false;
  flagsLastCorrect = false;
  private flagsBank: FlagEntry[] = [];

  // Element Symbols
  elementsRunning = false;
  elementsFinished = false;
  elementsScore = 0;
  elementsIndex = 0;
  elementsRounds = 10;
  elementsOptions: ElementEntry[] = [];
  elementsCorrectIndex = 0;
  elementsSelected: number | null = null;
  elementsAnswered = false;
  elementsLastCorrect = false;
  private elementsBank: ElementEntry[] = [];

  private bestKey = 'studyroom_games_best';
  scrambleTotal = SCRAMBLE_WORDS.length;

  constructor() {
    this.shuffleQuiz();
  }

  get flagTarget(): string {
    return this.flagsOptions[this.flagsCorrectIndex]?.flag ?? '';
  }

  get flagsCorrectCountry(): string {
    return this.flagsOptions[this.flagsCorrectIndex]?.country ?? '';
  }

  get elementTarget(): string {
    return this.elementsOptions[this.elementsCorrectIndex]?.name ?? '';
  }

  get elementCorrectName(): string {
    return this.elementsOptions[this.elementsCorrectIndex]?.name ?? '';
  }

  get elementCorrectSymbol(): string {
    return this.elementsOptions[this.elementsCorrectIndex]?.symbol ?? '';
  }

  ngOnDestroy(): void {
    if (this.mathTimer) clearInterval(this.mathTimer);
    if (this.memoryFlipTimer) clearTimeout(this.memoryFlipTimer);
    if (this.tfTimer) clearInterval(this.tfTimer);
    if (this.tfAdvanceTimer) clearTimeout(this.tfAdvanceTimer);
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

  // ---------- Memory Match ----------
  startMemory(): void {
    const picked = this.shuffle([...MEMORY_PAIRS]).slice(0, this.memoryPairCount);
    let cardId = 0;
    const cards: MemoryCard[] = [];
    picked.forEach((p, i) => {
      cards.push({ id: cardId++, pairId: i, text: p.term, flipped: false, matched: false });
      cards.push({ id: cardId++, pairId: i, text: p.def, flipped: false, matched: false });
    });
    this.memoryCards = this.shuffle(cards);
    this.memoryFirst = null;
    this.memoryMoves = 0;
    this.memoryLocked = false;
    this.memoryMatched = 0;
    this.memoryScore = 0;
    this.memoryRunning = true;
    this.memoryFinished = false;
    if (this.memoryFlipTimer) clearTimeout(this.memoryFlipTimer);
  }

  flipCard(i: number): void {
    if (this.memoryLocked || !this.memoryRunning) return;
    const card = this.memoryCards[i];
    if (card.flipped || card.matched) return;

    if (this.memoryFirst === null) {
      card.flipped = true;
      this.memoryFirst = i;
      return;
    }

    const first = this.memoryCards[this.memoryFirst];
    card.flipped = true;
    this.memoryMoves += 1;

    if (first.pairId === card.pairId) {
      first.matched = true;
      card.matched = true;
      this.memoryFirst = null;
      this.memoryMatched += 1;
      if (this.memoryMatched >= this.memoryPairCount) this.finishMemory();
    } else {
      this.memoryLocked = true;
      this.memoryFlipTimer = window.setTimeout(() => {
        first.flipped = false;
        card.flipped = false;
        this.memoryFirst = null;
        this.memoryLocked = false;
        this.memoryFlipTimer = undefined;
      }, 750);
    }
  }

  private finishMemory(): void {
    this.memoryRunning = false;
    this.memoryFinished = true;
    this.memoryScore = Math.max(0, 300 - this.memoryMoves * 10);
    this.recordBest('memory', this.memoryScore);
  }

  // ---------- True/False Sprint ----------
  startTrueFalse(): void {
    this.tfScore = 0;
    this.tfStreak = 0;
    this.tfTimeLeft = 30;
    this.tfLocked = false;
    this.tfFeedback = '';
    this.tfBank = this.shuffle([...TRUE_FALSE_BANK]);
    this.tfIndex = 0;
    this.tfQuestion = this.tfBank[0].text;
    this.tfRunning = true;
    this.tfFinished = false;
    if (this.tfTimer) clearInterval(this.tfTimer);
    this.tfTimer = setInterval(() => {
      this.tfTimeLeft -= 1;
      if (this.tfTimeLeft <= 0) {
        clearInterval(this.tfTimer);
        this.tfTimer = undefined;
        this.tfRunning = false;
        this.tfFinished = true;
        this.recordBest('truefalse', this.tfScore);
      }
    }, 1000);
  }

  answerTrueFalse(value: boolean): void {
    if (!this.tfRunning || this.tfLocked) return;
    const correct = value === this.tfBank[this.tfIndex].isTrue;
    this.tfFeedback = correct ? 'correct' : 'wrong';
    this.tfLastAnswer = value;
    if (correct) {
      this.tfScore += 1;
      this.tfStreak += 1;
    } else {
      this.tfStreak = 0;
    }
    this.tfLocked = true;
    if (this.tfAdvanceTimer) clearTimeout(this.tfAdvanceTimer);
    this.tfAdvanceTimer = window.setTimeout(() => {
      this.tfLocked = false;
      this.tfFeedback = '';
      this.tfIndex = (this.tfIndex + 1) % this.tfBank.length;
      this.tfQuestion = this.tfBank[this.tfIndex].text;
    }, 350);
  }

  // ---------- Flag Finder ----------
  startFlags(): void {
    this.flagsBank = this.shuffle([...FLAG_BANK]).slice(0, this.flagsRounds);
    this.flagsIndex = 0;
    this.flagsScore = 0;
    this.flagsRunning = true;
    this.flagsFinished = false;
    this.prepareFlagsRound();
  }

  private prepareFlagsRound(): void {
    const target = this.flagsBank[this.flagsIndex];
    const distractors = this.shuffle([...FLAG_BANK])
      .filter(c => c.country !== target.country)
      .slice(0, 3);
    this.flagsOptions = this.shuffle([target, ...distractors]);
    this.flagsCorrectIndex = this.flagsOptions.findIndex(o => o.country === target.country);
    this.flagsSelected = null;
    this.flagsAnswered = false;
  }

  answerFlags(i: number): void {
    if (this.flagsAnswered) return;
    this.flagsSelected = i;
    this.flagsAnswered = true;
    this.flagsLastCorrect = i === this.flagsCorrectIndex;
    if (this.flagsLastCorrect) this.flagsScore += 1;
  }

  nextFlags(): void {
    if (this.flagsIndex + 1 >= this.flagsRounds) {
      this.flagsRunning = false;
      this.flagsFinished = true;
      this.recordBest('flags', this.flagsScore);
      return;
    }
    this.flagsIndex += 1;
    this.prepareFlagsRound();
  }

  // ---------- Element Symbols ----------
  startElements(): void {
    this.elementsBank = this.shuffle([...ELEMENT_BANK]).slice(0, this.elementsRounds);
    this.elementsIndex = 0;
    this.elementsScore = 0;
    this.elementsRunning = true;
    this.elementsFinished = false;
    this.prepareElementsRound();
  }

  private prepareElementsRound(): void {
    const target = this.elementsBank[this.elementsIndex];
    const distractors = this.shuffle([...ELEMENT_BANK])
      .filter(e => e.name !== target.name)
      .slice(0, 3);
    this.elementsOptions = this.shuffle([target, ...distractors]);
    this.elementsCorrectIndex = this.elementsOptions.findIndex(e => e.name === target.name);
    this.elementsSelected = null;
    this.elementsAnswered = false;
  }

  answerElements(i: number): void {
    if (this.elementsAnswered) return;
    this.elementsSelected = i;
    this.elementsAnswered = true;
    this.elementsLastCorrect = i === this.elementsCorrectIndex;
    if (this.elementsLastCorrect) this.elementsScore += 1;
  }

  nextElements(): void {
    if (this.elementsIndex + 1 >= this.elementsRounds) {
      this.elementsRunning = false;
      this.elementsFinished = true;
      this.recordBest('elements', this.elementsScore);
      return;
    }
    this.elementsIndex += 1;
    this.prepareElementsRound();
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