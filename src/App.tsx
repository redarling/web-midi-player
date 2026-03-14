import './App.css';
import {InstructionsPlayer} from './panes/InstructionsPlayer';

function App() {
  return (
    <div className="app">
      <div className="pane" tabIndex={0}>
        <div className="pane-content">
          <InstructionsPlayer />
        </div>
      </div>
    </div>
  );
}

export default App;
