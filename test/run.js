const Promise = require('bluebird')
const {Run, RunRcError, RunError} = require('../run')

function genRunCmd(...cmd){
  return function(){
    return Run.fullLog(...cmd)
      .catch(RunRcError, err => console.error('Bad rc %s', ...cmd, err.results.exit_code))
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
