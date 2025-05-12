import React, {useState} from 'react'
import Input from './Input/Input'
function App() {
  const [val, setVal] = useState()
  return (
    <div className="App">
      <Input
        value={val}
        onChange={setVal}
      />
    </div>
  );
}

export default App;
