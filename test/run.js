//const Promise = require('bluebird')
const {run, RunRcError, RunError} = require('../run')

function genRunCmd(...cmd){
  return function(){
    return run(...cmd)
      .then(res => {
        console.log('Run ran: %s [%s]', res.command, res.exit_code)
        if ( res.stdout.length > 0 ) console.log(' stdout: %s', res.stdout.join('\n'))
        if ( res.stderr.length > 0 ) console.log(' stderr: %s', res.stderr.join('\n')) 
      })
      .catch(RunRcError, err => {
        let res = err.results
        console.error('Run rc error [%s]: %s', res.exit_code, res.stderr.join('\n'))
        if ( res.stdout.length > 0 ) console.error('Run rc stdout: %s', res.stdout.join('\n'))
      })
      .catch(RunError, err => console.error('Run error:', err ))
      .catch(err => console.error('Error:', err ))
  }
}

genRunCmd('ls')()
  .then(genRunCmd('wc','-b','error-goog.png'))
  .then(genRunCmd('ls','-al'))
  .then(genRunCmd('ls','whatever'))
  .then(genRunCmd('lsa','broke'))
  .then(genRunCmd('ls','sp ace', {ignore_rc:true}))
