Run a process, store it's output, log things

```javascript
const {Run, RunRcError, RunError} = require('@deployable/run')

function genRunCmd(...cmd){
  return function(){
    return Run.fullLog(...cmd)
      .catch(RunRcError, err => console.error('Bad rc %s', err.results.exit_code))
      .catch(RunError, err => console.error('RunError: ', err))
      .catch(err => console.error('Error: ', err ))
  }
}

genRunCmd('ls')()
  .then(genRunCmd('wc','-c','/etc/passwd'))
  .then(genRunCmd('ls','-al'))
  .then(genRunCmd('ls','whatever'))
  .then(genRunCmd('lsa','broke'))
  .then(genRunCmd('ls','sp ace', {ignore_rc:true}))

```

```
Run[90629] Running: ["ls"]
Run[90629] stdout: error-goog.png
Run[90629] stdout: search-bing.png
Run[90629] stdout: search.js
Run[90629] Finished: ["ls"]
```
