Run a process, store it's output, log things

```javascript
const {Run, RunRcError, RunError} = require('../run')

function genRunCmd(...cmd){
  return function(){
    return Run.fullLog(...cmd)
      .catch(RunRcError, err => console.error(' Got a bad rc "%s"', err.results.command, err.results.exit_code))
      .catch(RunError, err => console.error(' Got a RunError: ', err))
      .catch(err => console.error(' Got an Error: ', err ))
  }
}

genRunCmd('ls')()
  .then(genRunCmd('ls','whatever'))
  .then(genRunCmd('lsa','broke'))
  .then(genRunCmd('ls','sp ace', { ignore_rc: true }))
```

Output

```
$ node test/run.js
Run[92063] Running: ["ls"]
Run[92063] stdout: error-goog.png
Run[92063] stdout: search-bing.png
Run[92063] stdout: search.js
Run[92063] Finished: ["ls"]
Run[92064] Running: ["ls","whatever"]
Run[92064] stderr: ls: whatever: No such file or directory
Run[92064] Failed: ["ls","whatever"]
 Got a bad rc "ls,whatever" 1
Run[] Running: ["lsa","broke"]
Run[] Run failed to start command ["lsa","broke"]: Command not found [lsa]
 Got a RunError:  Command not found [lsa]
Run[92066] Running: ["ls","sp ace"]
Run[] Failed: ["lsa","broke"]
Run[92066] stderr: ls: sp ace: No such file or directory
Run[92066] Failed: ["ls","sp ace"]
 Got a bad rc "ls,sp ace" 1

```

`Run` comes with some preset class setups

### `Run.startLog(command)`

Log state of command and errors

### `Run.fullLog(command)`

Log stdout and stderr while running

### `Run.postLog(command)`

Log stdout and stderr after completion