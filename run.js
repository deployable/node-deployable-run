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



class Run {

  static logArray(pid, tag, data){
    let dl = data.length 
    if (!dl) return 
    for( let i=0; i < dl; i++ ){
      Run.log(pid, tag, data[i])
    }
  }

  static log(pid, tag, msg){
    console.log('Run[%s] %s: %s', pid, tag, msg)
  }

  static startLog(...command){
    let run = new Run({
      log_start: true,
      log_end_failure: true
    })
    return run.run(...command)
  }
  static fullLog(...command){
    let run = new Run({
      log_start: true,
      log_stdout: true,
      log_stderr: true,
      log_end_success: true,
      log_end_failure: true
    })
    return run.run(...command)
  }
  static postLog(...command){
    let run = new Run({
      log_start: true,
      log_end_success: true,
      log_end_success_stdout: true,
      log_end_success_stderr: true,
      log_end_failure: true
    })
    return run.run(...command)
  }

  constructor( options = {} ){
      // Pull options if they exist
      debug('new Run got options', options)

      // stdout/stderr are processed into lines and put in array by default
      // Turn this off if you're worried about perf. 
      this.stdout = []
      this.stderr = []
      if ( options.save_stdout === false ) this.stdout = false
      if ( options.save_stderr === false ) this.stderr = false
      
      // Log both stderr and stdout in order
      let std = false
      if ( Boolean(options.save_std) === true ) this.std = []

      // noop logger by default
      this.log_start_pre =          (options.log_start_pre)          ? Run.log       : noop
      this.log_start =              (options.log_start)              ? Run.log       : noop
      this.log_stdout =             (options.log_stdout)             ? Run.log       : noop
      this.log_stderr =             (options.log_stderr)             ? Run.log       : noop
      this.log_end_success =        (options.log_end_success)        ? Run.log       : noop
      this.log_end_success_stdout = (options.log_end_success_stdout) ? Run.logArray  : noop
      this.log_end_success_stderr = (options.log_end_success_stderr) ? Run.logArray  : noop
      this.log_end_failure =        (options.log_end_failure)        ? Run.log       : noop
      this.log_end_failure_stdout = (options.log_end_failure_stdout) ? Run.logArray  : noop
      this.log_end_failure_stderr = (options.log_end_failure_stderr) ? Run.logArray  : noop

      this.logger = {
        error:  noop,
        warn:   noop,
        info:   noop,
        debug:  noop
      }
      if ( options.logger ) this.logger = options.logger

      // Optionally log stdout/stderr lines
      this.stdout_log_fn = ( options.log || options.log_stdout )
        ? function(line){ this.logger.info('stderr',line) }
        : noop
      this.stderr_log_fn = ( options.log || options.log_stderr )
        ? function(line){ this.logger.info('stdout',line) }
        : noop


      // Optionally store the raw buffer data
      this.stdout_buffer = false
      this.stderr_buffer = false
      this.stdout_buffer_fn = noop
      this.stderr_buffer_fn = noop
      if (options.save_buffer || options.save_stdout_buffer) {
        this.stdout_buffer_fn = function(data, o){ stdout_buffer.push(data) }
        this.stdout_buffer = []
      }    
      if (options.save_buffer || options.save_stderr_buffer){
        this.stdout_buffer_fn = function(data, o){ stdout_buffer.push(data) }
        this.stderr_buffer = []
      }

      // Pipe data
      this.stdout_pipe_fn = (options.stdout_pipe)
        ? options.stdout_pipe
        : noop
      this.stderr_pipe_fn = (options.stderr_pipe) 
        ? options.stderr_pipe
        : noop

      // Data callbacks
      this.stderr_cb = options.stderr_cb || noop
      this.stdout_cb = options.stdout_cb || noop
      this.stderr_line_cb = options.stderr_line_cb || noop
      this.stdout_line_cb = options.stdout_line_cb || noop
      this.close_cb = options.close_cb || noop

      // Ignore return code, i.e. do not throw
      this.ignore_rc = Boolean(options.ignore_rc)
      this.normal_exit_code = options.normal_exit_code || 0

  }

  run( ...command /*,options */){
    return new Promise((resolve, reject) => {

      let options = {}
      if ( typeof command[command.length-1] === 'object' ) options = command.pop()

      // Setup the basics for spawn
      const exec = command[0]
      const args = command.slice(1)

      // loop storage
      let stdout_next = ''
      let stderr_next = ''
      let stdout = []
      let stderr = []
      let stdout_buffer = []
      let stderr_buffer = []

      // Create a string of the command for use in loggin
      const command_str = JSON.stringify(command)
      debug('run: %s', command_str)

      // Setup the command to spawn
      this.log_start_pre(0, 'Running', command_str)
      const cmd = spawn(exec, args)
      this.log_start(cmd.pid||'', 'Running', command_str)

      // stdout
      cmd.stdout.on('data', (data) => {
        debug('stdout[%s]: %s', cmd.pid, data)
        this.stdout_cb(data, this)
        this.stdout_buffer_fn(data, this)
        this.stdout_pipe_fn(data)
        //stdout_fn(data)
        if (this.stdout) {
          let lines = ( stdout_next + data.toString() ).split('\n')
          // Save end of buffer for next line in case it's not ''
          stdout_next = lines.pop()
          stdout = stdout.concat(lines)
          if (this.std) this.std = this.std.concat(lines)

          let ll = lines.length 
          for( let i=0; i < ll; i++ ){
            this.stdout_line_cb(lines[i])
            this.log_stdout(cmd.pid, 'stdout', lines[i], this)
          }
        }
      })
      
      // stderr
      cmd.stderr.on('data', (data) => {
        debug('stderr[%s]: %s', cmd.pid, data)
        this.stderr_cb(data, this)
        this.stderr_buffer_fn(data, this)
        this.stderr_pipe_fn(data)
        //stderr_fn(data)
        if (this.stderr) {
          let lines = ( stderr_next + data.toString() ).split('\n')
          // Save end of buffer for next line in case it's not ''
          stderr_next = lines.pop()
          stderr = stderr.concat(lines)
          if (this.std) std = std.concat(lines)

          lines.forEach(line => {
            this.stderr_line_cb(line)
            this.log_stderr(cmd.pid, 'stderr', line, this)
          })
        }
      })
      
      // End
      cmd.on('close', (exit_code) => {
        debug('Run %s pid %s exited with exit code [%s]', command_str, cmd.pid, exit_code)
        this.close_cb(exit_code, this)
        if ( this.stdout_next !== '' ) this.stdout.push(stdout_next)
        if ( this.stderr_next !== '' ) this.stderr.push(stderr_next)
        
        let results = {
          command,
          options: this.options,
          stdout,
          stderr,
          stdout_buffer,
          stderr_buffer,
          exit_code,
          pid: cmd.pid
        }

        if (exit_code === this.normal_exit_code || this.ignore_rc ) {
          this.log_end_success(cmd.pid, 'Finished', command_str, exit_code)
          this.log_end_success_stdout(cmd.pid, 'stdout', stdout)
          this.log_end_success_stderr(cmd.pid, 'stderr', stderr)
          return resolve(results)
        }
        let error = new RunRcError(`Run ${command_str} exited with code [${exit_code}]`)
        error.results = results
        this.log_end_failure(cmd.pid||'', 'Failed', command_str, exit_code)
        reject(error)
      })
      
      // Catch an initial error
      cmd.on('error', (err) => {
        switch (err.code) {
          case 'ENOENT': 
            err = new RunError(`Command not found [${command[0]}]`)
            break
          case 'ENOPERM':
            err = new RunError(`Command not allowed [${command[0]}]`)
            break
          case 'ENOACCESS':
            err = new RunError(`Command not executable [${command[0]}]`)
            break
        }
        err.results = {
          command,
          options: this.options,
          pid: cmd.pid
        }
        this.log_end_failure(cmd.pid||'', `Run failed to start command ${command_str}`, err.message)
        reject(err)
      })
    })
  }
}


module.exports = {Run, RunError, RunRcError}