import {ChangeEventHandler, useCallback, useEffect, useState} from 'react';
import {Score} from '../types';
import {PlayerModal} from '../visualization/PlayerModal';

const tunes = [
  {name: '5 Notes', data: '5_notes.json'},
  {name: 'Item Discovery', data: 'item-discovery.json'},
  {name: "Yoshi's Island", data: 'yoshi-s-island.json'},
  {name: 'Tetris', data: 'tetris.json'},
  {name: 'The Legend of Zelda', data: 'zelda.json'},
  {name: 'Super Mario Bros.', data: 'smb.json'},
  {name: 'Megaman 3', data: 'megaman3.json'},
  {name: 'Super Mario Bros. 3', data: 'smb3.json'},
  {name: 'Little Nemo', data: 'dream-1-mushroom-forest.json'},
  {name: 'Duck Tales', data: 'the-moon.json'},
  {name: 'MEGALOVANIA', data: 'megalovania.json'},
];

export const InstructionsPlayer = () => {
  const defaultTune = tunes.find((tune) => tune.data === 'megalovania.json')!;
  const [tuneFile, setTuneFile] = useState(parseRouteTuneFile() || defaultTune.data);
  const [score, setScore] = useState<Score>();
  const [shouldAutoStart, setShouldAutoStart] = useState(true);

  const isModalOpen = score !== undefined;

  const onSelect: ChangeEventHandler<HTMLSelectElement> = useCallback((event) => {
    setTuneFile(event.target.value);
  }, []);

  const onPlay = useCallback(async () => {
    const response = await fetch(`tunes/${tuneFile}`);
    const newScore = await response.json();

    setScore(newScore);
  }, [tuneFile]);

  const onAutoStart = useCallback(() => setShouldAutoStart(false), []);

  const onCloseModal = useCallback(() => {
    setScore(undefined);
    setShouldAutoStart(true);
  }, []);

  useEffect(() => {
    const routeTuneFile = parseRouteTuneFile();

    if (routeTuneFile !== tuneFile) {
      window.history.replaceState('', '', `${window.location.pathname}?tune=${tuneFile}`);
    }
  });

  return (
    <>
      <h1>MIDI Player</h1>

      <div className="player-card">
        <div className="player-controls">
          <div className="select">
            <select onChange={onSelect} defaultValue={tuneFile}>
              {tunes.map((tune) => (
                <option key={tune.data} value={tune.data}>
                  {tune.name}
                </option>
              ))}
            </select>
          </div>

          <button className="primary" onClick={onPlay} disabled={isModalOpen}>
            Play
          </button>
        </div>
      </div>

      <h2>How it works</h2>

      <p>
        A browser-based MIDI player that reads music scores in JSON format and plays them through a Web Audio
        synthesizer with real-time piano roll visualization.
      </p>

      <p>
        Each score consists of multiple <strong>tracks</strong>, where each track is assigned an instrument and
        contains a list of notes. Every note has a <code>time</code>, <code>duration</code>, <code>name</code> (pitch),
        and <code>velocity</code> (volume). The player converts all notes into a sorted event timeline and processes
        them chronologically, scheduling playback through the synthesizer.
      </p>

      <h2>Features</h2>

      <ul>
        <li><strong>Play / Stop</strong> &mdash; start and interrupt playback at any time.</li>
        <li><strong>Rewind / Forward</strong> &mdash; seek 2 seconds in either direction with automatic restoration of sustaining notes.</li>
        <li><strong>Live visualization</strong> &mdash; a scrolling piano roll that renders notes in real time, color-coded by pitch.</li>
        <li><strong>Reference view</strong> &mdash; toggle between what the player is producing and the original score.</li>
      </ul>

      <h2>Limitations</h2>

      <ul>
        <li><code>delayAsync</code> is non-reentrant &mdash; only one delay can be active at a time.</li>
        <li>Each channel plays one note at a time; overlapping notes within a track are split into separate channels.</li>
        <li>Browser timing has limited precision; <code>buildTimer()</code> based on <code>performance.now()</code> is used to avoid drift.</li>
        <li>Audio quality is constrained by the lightweight Web Audio synth.</li>
      </ul>

      {isModalOpen && (
        <PlayerModal
          score={score}
          shouldAutoStart={shouldAutoStart}
          onAutoStart={onAutoStart}
          onRequestClose={onCloseModal}
        />
      )}
    </>
  );
};

function parseRouteTuneFile() {
  const routeTune = new URL(window.location.href).searchParams.get('tune');
  if (!routeTune) {
    return undefined;
  }

  return tunes.some((tune) => tune.data === routeTune) ? routeTune : undefined;
}
