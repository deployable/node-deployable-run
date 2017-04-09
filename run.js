const Promise = require('bluebird')
const debug = require('debug')('dply:run')
const spawn = require('child_process').spawn
const noop = function(){}


class RunError extends Error {
    constructor( message, options = {} ){
    super(message)
    this.name = this.constructor.name
    this.message = message

    ;(Error.captureStackTrace)
      ? Error.captureStackTrace(this, this.constructor)
      : this.stack = (new Error(message)).stack
  }
}
class RunRcError extends RunError {}


function run( ...command /*, options */){
  return new Promise((resolve, reject) => {

    // Pull options if they exist
    let options = {}
    if ( typeof command[command.length-1] === 'object' ) {
      options = command.pop()
      debug('run got options', options)
    }

    // Setup the basics for spawn
    const exec = command[0]
    const args = command.slice(1)

    // Create a string of the command for use in loggin
    const command_str = JSON.stringify(command)
    debug('run: %s', command_str)

    // stdout/stderr are processed into lines and put in array by default
    // Turn this off if you're worried about perf. 
    let stdout = []
    let stderr = []
    if ( options.save_stdout === false ) stdout = false
    if ( options.save_stderr === false ) stderr = false

    // noop logger by default
    let logger = {
      error:  noop,
      warn:   noop,
      info:   noop,
      debug:  noop
    }
    if ( options.logger ) logger = options.logger

    // Optionally log stdout/stderr lines
    let stdout_log_fn = ( options.log || options.log_stdout )
      ? function(line){ logger.info('stderr',line) }
      : noop
    let stderr_log_fn = ( options.log || options.log_stderr )
      ? function(line){ logger.info('stdout',line) }
      : noop

    // Optionally store the raw buffer data
    let stdout_buffer = false
    let stderr_buffer = false
    let stdout_buffer_fn = noop
    let stderr_buffer_fn = noop
    if (options.save_buffer || options.save_stdout_buffer) {
      stdout_buffer_fn = function(data, o){ stdout_buffer.push(data) }
      stdout_buffer = []
    }    
    if (options.save_buffer || options.save_stderr_buffer){
      stdout_buffer_fn = function(data, o){ stdout_buffer.push(data) }
      stderr_buffer = []
    }

    // Pipe data
    const stdout_pipe_fn = (options.stdout_pipe)
      ? options.stdout_pipe
      : noop
    const stderr_pipe_fn = (options.stderr_pipe) 
      ? options.stderr_pipe
      : noop

    // Data callbacks
    const stderr_cb = options.stderr_cb || noop
    const stdout_cb = options.stdout_cb || noop
    const stderr_line_cb = options.stderr_line_cb || noop
    const stdout_line_cb = options.stdout_line_cb || noop
    const close_cb = options.close_cb || noop

    // Ignore return code, i.e. do not throw
    const ignore_rc = Boolean(options.ignore_rc)
    const normal_exit_code = options.normal_exit_code || 0

    // Storage for stderr/stdout processing
    let stderr_next = ''
    let stdout_next = ''


    // Setup the command to spawn
    const cmd = spawn(exec, args)

    // stdout
    cmd.stdout.on('data', (data) => {
      debug('stdout[%s]: %s', cmd.pid, data)
      stdout_cb(data, this)
      stdout_buffer_fn(data, this)
      stdout_pipe_fn(data)
      //stdout_fn(data)
      if (stdout) {
        let lines = ( stdout_next + data.toString() ).split('\n')
        // Save end of buffer for next line in case it's not ''
        stdout_next = lines.pop()
        stdout = stdout.concat(lines)

        let ll = lines.length 
        for( let i=0; i < ll; i++ ){
          stdout_line_cb(lines[i])
          stdout_log_fn(lines[i], this)
        }
      }
    })
    
    // stderr
    cmd.stderr.on('data', (data) => {
      debug('stderr[%s]: %s', cmd.pid, data)
      stderr_cb(data, this)
      stderr_buffer_fn(data, this)
      stderr_pipe_fn(data)
      //stderr_fn(data)
      if (stderr) {
        let lines = ( stderr_next + data.toString() ).split('\n')
        // Save end of buffer for next line in case it's not ''
        stderr_next = lines.pop()
        stderr = stderr.concat(lines)

        lines.forEach(line => {
          stderr_line_cb(line)
          stderr_log_fn(line, this)
        })
      }
    })
    
    // End
    cmd.on('close', (exit_code) => {
      debug('Run %s pid %s exited with exit code [%s]', command_str, cmd.pid, exit_code)
      close_cb(exit_code, this)
      if ( stdout_next !== '' ) stdout.push(stdout_next)
      if ( stderr_next !== '' ) stderr.push(stderr_next)
      
      let results = {
        command,
        options,
        stdout,
        stderr,
        stdout_buffer,
        stderr_buffer,
        exit_code,
        pid: cmd.pid
      }

      if (exit_code === normal_exit_code || ignore_rc ) return resolve(results)
      
      let error = new RunRcError(`Run ${command_str} exited with code [${exit_code}]`)
      error.results = results
      reject(error)
    })
    
    // Catch an initial error
    cmd.on('error', (err) => {
      switch (err.code) {
        case 'ENOENT': err = new RunError(`Run command not found [${command[0]}]`)
        case 'ENOPERM': err = new RunError(`Run command not allowed [${command[0]}]`)
        case 'ENOACCESS': err = new RunError(`Run command not executable [${command[0]}]`)
      }
      err.results = {
        command,
        options
      }
      logger.error('Run failed to start command %s', command_str, err)
      reject(err)
    })
  })
}

module.exports = {run, RunError, RunRcError}