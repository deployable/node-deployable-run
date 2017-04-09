const {Run, RunRcError, RunError} = require('../run')

function genRunCmd(...cmd){
  return function(){
    return Run.fullLog(...cmd)
      .catch(RunRcError, err => console.error(' Got a bad rc "%s"', err.results.command, err.results.exit_code))
      .catch(RunError, err => console.error(' Got a RunError: ', err.message ))
      .catch(err => console.error(' Got an Error: ', err.message ))
  }
}

genRunCmd('ls')()
  .then(genRunCmd('ls','whatever'))
  .then(genRunCmd('lsa','broke'))
  .then(genRunCmd('ls','sp ace', { ignore_rc: true }))

