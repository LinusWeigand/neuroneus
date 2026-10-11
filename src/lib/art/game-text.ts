export type GameLanguage = "English" | "German";

const BASE: Record<GameLanguage, Record<string, string>> = {
  English: {
    pressToStart: "Press Space to start",
    tapToStart: "Tap to start",
    best: "Best",
    score: "Score",
    lives: "Lives",
    paused: "Paused",
    resume: "Resume",
    restart: "Restart",
    toTitle: "Title screen",
    gameOver: "Game over",
    playAgain: "Play again",
    newBest: "New best!",
    hint: "Arrows or WASD to move · Esc to pause · M to mute",
  },
  German: {
    pressToStart: "Leertaste zum Starten",
    tapToStart: "Tippen zum Starten",
    best: "Rekord",
    score: "Punkte",
    lives: "Leben",
    paused: "Pause",
    resume: "Weiter",
    restart: "Neu starten",
    toTitle: "Titelbildschirm",
    gameOver: "Spiel vorbei",
    playAgain: "Nochmal spielen",
    newBest: "Neuer Rekord!",
    hint: "Pfeiltasten oder WASD · Esc für Pause · M für Ton aus",
  },
};

export function gameText(language: GameLanguage, title: string, tagline: string) {
  return { title, tagline, ...BASE[language] };
}
