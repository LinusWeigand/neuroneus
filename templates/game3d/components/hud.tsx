"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { actions, store, type GameState } from "@/game/store";
import { TEXT } from "@/game/text";

const noSubscription = () => () => {};

function useGame() {
  return useSyncExternalStore(store.subscribe, () => store.state, () => store.state);
}

function useTouch() {
  return useSyncExternalStore(noSubscription, () => window.matchMedia("(pointer: coarse)").matches, () => false);
}

export function Hud() {
  const game = useGame();
  return (
    <div className="pointer-events-none absolute inset-0 font-game-body text-game-text">
      {game.screen === "loading" && <Loading progress={game.progress} />}
      {game.screen === "title" && <Title best={game.best} />}
      {(game.screen === "play" || game.screen === "paused") && <PlayBar game={game} />}
      {game.screen === "paused" && <Paused />}
      {game.screen === "over" && <GameOver game={game} />}
    </div>
  );
}

function Loading({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-game-background">
      <h1 className="font-game-display text-3xl tracking-wide text-game-text">{TEXT.title}</h1>
      <div className="h-2 w-56 overflow-hidden rounded-full bg-game-surface">
        <div className="h-full rounded-full bg-game-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

function Title({ best }: { best: number }) {
  const touch = useTouch();
  return (
    <div className="absolute inset-0 bg-linear-to-t from-game-background via-game-background/20 to-game-background/40">
      <button type="button" aria-label={touch ? TEXT.tapToStart : TEXT.pressToStart} onClick={actions.start} className="pointer-events-auto absolute inset-0 cursor-pointer" />
      <div className="absolute inset-x-0 bottom-[12vh] flex animate-hud-in flex-col items-center gap-4 px-6 text-center">
        <h1 className="font-game-display text-[clamp(2.75rem,9vw,6.5rem)] leading-[0.95] tracking-tight [text-shadow:0_0_32px_var(--game-primary),0_5px_0_var(--game-outline)]">
          {TEXT.title}
        </h1>
        <p className="max-w-xl text-lg text-game-text-muted">{TEXT.tagline}</p>
        <p className="mt-6 animate-hud-pulse font-game-display text-xl tracking-widest text-game-accent uppercase">{touch ? TEXT.tapToStart : TEXT.pressToStart}</p>
        {best > 0 && (
          <p className="text-sm tracking-widest text-game-text-muted uppercase">
            {TEXT.best} <span className="font-game-display text-game-text">{best}</span>
          </p>
        )}
        {!touch && <p className="mt-2 text-xs text-game-text-muted/80">{TEXT.hint}</p>}
      </div>
    </div>
  );
}

function PlayBar({ game }: { game: GameState }) {
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-[max(16px,env(safe-area-inset-top))] px-6">
      <Panel className="min-w-28 px-5 py-2.5">
        <p className="text-[11px] tracking-[0.2em] text-game-text-muted uppercase">{TEXT.score}</p>
        <p key={game.score} className="origin-left animate-hud-pop font-game-display text-3xl leading-tight tabular-nums">
          {game.score}
        </p>
      </Panel>
      <div className="flex items-center gap-3">
        <Panel className="flex items-center gap-2.5 px-4 py-3" label={TEXT.lives}>
          {Array.from({ length: Math.max(0, game.lives) }, (_, i) => (
            <span key={i} className="size-3.5 rotate-45 rounded-[3px] bg-game-danger shadow-[0_0_12px_var(--game-danger)]" />
          ))}
        </Panel>
        <button
          type="button"
          aria-label={TEXT.paused}
          onClick={actions.pause}
          className="pointer-events-auto flex size-12 items-center justify-center gap-1.5 rounded-full border-2 border-game-outline bg-game-surface/80 backdrop-blur transition hover:scale-105 active:scale-95"
        >
          <span className="h-4 w-1.5 rounded-sm bg-game-text" />
          <span className="h-4 w-1.5 rounded-sm bg-game-text" />
        </button>
      </div>
    </div>
  );
}

function Paused() {
  return (
    <Overlay>
      <h2 className="font-game-display text-4xl">{TEXT.paused}</h2>
      <Menu>
        <MenuButton primary onClick={actions.resume} autoFocus>
          {TEXT.resume}
        </MenuButton>
        <MenuButton onClick={actions.restart}>{TEXT.restart}</MenuButton>
        <MenuButton onClick={actions.toTitle}>{TEXT.toTitle}</MenuButton>
      </Menu>
    </Overlay>
  );
}

function GameOver({ game }: { game: GameState }) {
  return (
    <Overlay>
      <h2 className="font-game-display text-4xl text-game-danger [text-shadow:0_0_24px_var(--game-danger)]">{TEXT.gameOver}</h2>
      <div className="flex flex-col items-center">
        <p className="text-[11px] tracking-[0.2em] text-game-text-muted uppercase">{TEXT.score}</p>
        <p className="font-game-display text-6xl tabular-nums">{game.score}</p>
        {game.newBest ? (
          <p className="mt-2 animate-hud-pulse rounded-full bg-game-accent px-3 py-1 text-sm font-semibold text-game-background">{TEXT.newBest}</p>
        ) : (
          <p className="mt-2 text-sm text-game-text-muted">
            {TEXT.best} {game.best}
          </p>
        )}
      </div>
      <Menu>
        <MenuButton primary onClick={actions.restart} autoFocus>
          {TEXT.playAgain}
        </MenuButton>
        <MenuButton onClick={actions.toTitle}>{TEXT.toTitle}</MenuButton>
      </Menu>
    </Overlay>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-game-background/55 p-6 backdrop-blur-sm">
      <Panel className="flex w-full max-w-sm animate-hud-in flex-col items-center gap-6 px-8 py-9 text-center">{children}</Panel>
    </div>
  );
}

function Panel({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div aria-label={label} className={`rounded-[18px] border-2 border-game-outline bg-game-surface/85 shadow-[0_8px_0_var(--game-outline),0_18px_40px_-12px_var(--game-outline)] backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Menu({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-3">{children}</div>;
}

function MenuButton({ children, onClick, primary = false, autoFocus = false }: { children: ReactNode; onClick: () => void; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={`w-full rounded-full border-2 border-game-outline px-6 py-3 font-game-display text-lg tracking-wide transition outline-none hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-game-accent/60 active:translate-y-0.5 ${
        primary ? "bg-game-primary text-game-background shadow-[0_5px_0_var(--game-outline)]" : "bg-game-background-alt text-game-text shadow-[0_4px_0_var(--game-outline)]"
      }`}
    >
      {children}
    </button>
  );
}
