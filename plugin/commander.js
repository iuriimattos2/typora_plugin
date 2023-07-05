(() => {
    const config = {
        // 启用脚本,若为false,以下配置全部失效
        ENABLE: true,
        // 允许拖动模态框
        ALLOW_DRAG: true,
        // 启用内建的命令列表
        USE_BUILTIN: true,
        // wsl distribution
        WSL_DISTRIBUTION: "Ubuntu-16.04",
        // 快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.key.toLowerCase() === "g",

        DEBUG: false
    }

    if (!config.ENABLE) {
        return
    }

    const SHELL = {
        CMD_BASH: "cmd/bash",
        POWER_SHELL: "powershell",
        GIT_BASH: "gitbash",
        WSL: "wsl",
    }

    const BUILTIN = [
        {name: "", shell: SHELL.CMD_BASH, cmd: ""}, // dummy
        {name: "OpenInExplorer", shell: SHELL.CMD_BASH, cmd: "explorer $d"},
        {name: "OpenInVscode", shell: SHELL.CMD_BASH, cmd: "code $f"},
        {name: "GitCommit", shell: SHELL.CMD_BASH, cmd: `cd $m && git add . && git commit -m "message"`},
    ];

    (() => {
        const modal_css = `
        #typora-commander {
            position: fixed;
            top: 30%;
            left: 55%;
            width: 600px;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
            transform: translate3d(0, 0, 0)
        }
        
        .mac-seamless-mode #typora-commander {
            top: 30px
        }
        
        #typora-commander-form {
            display: flex;
            align-items: center;
            font-size: 14px;
            line-height: 25px;
        }
        
        #typora-commander-form select,input {
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            height: 27px;
            margin-top: 1px;
            margin-bottom: 1px;
        }
        
        #typora-commander-form select {
            width: 20%;
            margin-left: 2.5px;
            margin-right: 0;
            padding: 1px 2px;
        }
        
        #typora-commander-form input {
            width: 60%;
            margin-left: 0;
            margin-right: 2.5px;
            padding-left: 20px;
            padding-right: 5px;
        }
        
        #typora-commander-form input:focus {
            outline: 0
        }
        
        #typora-commander-form .typora-commander-commit,
        #typora-commander-form .typora-commander-commit:hover {
            position: absolute;
            padding: 1px;
            left: 10px;
            opacity: 0.7;
            cursor: pointer;
        }
        
        .typora-commander-output {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-y: auto;
            overflow-x: auto;
        }
        
        .typora-commander-output pre {
            display: inline-block;
            font-size: 13px;
            line-height: 1.1;
            margin: 10px 10px 5px 5px;
        }
        
        .typora-commander-output pre.error {
            color: red;
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const windowOption = (File.isMac) ? `` : `
            <option value="${SHELL.POWER_SHELL}">powershell</option>
            <option value="${SHELL.GIT_BASH}">git bash</option>
            <option value="${SHELL.WSL}">wsl</option>
        `;
        const builtin = BUILTIN.map(ele => `<option shell="${ele.shell}" value='${ele.cmd}'>${ele.name}</option>`).join("");
        const builtinSelect = !config.USE_BUILTIN ? "" : `<select class="typora-commander-builtin">${builtin}</select>`;

        const div = `
        <div id="typora-commander-form">
            <input type="text" class="input" placeholder="Typora commander" autocorrect="off" spellcheck="false"
                autocapitalize="off" data-lg="Front" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
            <i class="ion-ios7-play typora-commander-commit"></i>
            <select class="typora-commander-shell"><option value="${SHELL.CMD_BASH}">cmd/bash</option>${windowOption}</select>
            ${builtinSelect}
        </div>
        <div class="typora-commander-output" id="typora-commander-output" style="display:none"><pre></pre></div>
       `
        const modal = document.createElement("div");
        modal.id = 'typora-commander';
        modal.style.display = "none";
        modal.innerHTML = div;
        const searchPanel = document.getElementById("md-searchpanel");
        searchPanel.parentNode.insertBefore(modal, searchPanel.nextSibling);

        if (!config.USE_BUILTIN) {
            document.getElementById('typora-commander').style.width = "500px";
            document.querySelector("#typora-commander-form input").style.width = "80%";
        }
    })()

    const modal = {
        modal: document.getElementById('typora-commander'),
        input: document.querySelector("#typora-commander-form input"),
        shellSelect: document.querySelector("#typora-commander-form .typora-commander-shell"),
        builtinSelect: document.querySelector("#typora-commander-form .typora-commander-builtin"),
        commit: document.querySelector("#typora-commander-form .typora-commander-commit"),
        output: document.querySelector("#typora-commander-output"),
        pre: document.querySelector("#typora-commander-output pre")
    }

    const Package = {
        child_process: reqnode('child_process'),
        path: reqnode('path'),
    };

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey

    const convertPath = (path, shell) => {
        if (File.isMac) {
            return path
        }
        switch (shell) {
            case SHELL.WSL:
            case SHELL.GIT_BASH:
                path = path.replace(/\\/g, "/");
                const tempList = path.split(":");
                if (tempList.length !== 2) {
                    return path
                }
                const disk = tempList[0].toLowerCase();
                const remain = tempList[1];
                return (shell === SHELL.GIT_BASH) ? `/${disk}${remain}` : `/mnt/${disk}${remain}`
            case SHELL.CMD_BASH:
            case SHELL.POWER_SHELL:
            default:
                return path
        }
    }

    const getFile = shell => convertPath(File.filePath, shell);
    const getFolder = shell => convertPath(Package.path.dirname(File.filePath), shell);
    const getMountFolder = shell => convertPath(File.getMountFolder(), shell);

    const replaceArgs = (cmd, shell) => {
        const file = getFile(shell);
        const folder = getFolder(shell);
        const mount = getMountFolder(shell);
        cmd = cmd.replace(/\$f/g, `"${file}"`);
        cmd = cmd.replace(/\$d/g, `"${folder}"`);
        cmd = cmd.replace(/\$m/g, `"${mount}"`);
        return cmd
    }

    const getShellCommand = env => {
        switch (env) {
            case SHELL.GIT_BASH:
                return `bash.exe -c`
            case SHELL.POWER_SHELL:
                return `powershell /C`
            case SHELL.WSL:
                return `wsl.exe -d ${config.WSL_DISTRIBUTION} -e bash -c`
            default:
                return File.isMac ? `bash -c` : `cmd /C`;
        }
    }

    const exec = (cmd, shell, resolve, reject) => {
        const _shell = getShellCommand(shell);
        const _cmd = replaceArgs(cmd, shell);
        Package.child_process.exec(`chcp 65001 | ${_shell} "${_cmd}"`, {encoding: 'utf8'},
            (err, stdout, stderr) => {
                if (err || stderr.length) {
                    reject = reject ? reject : console.error;
                    reject(err.toString() || stderr.toString());
                } else {
                    resolve = resolve ? resolve : console.log;
                    resolve(stdout);
                }
            })
    }

    const showStdout = stdout => {
        modal.output.style.display = "block";
        modal.pre.classList.remove("error");
        modal.pre.textContent = stdout;
    }

    const showStdErr = stderr => {
        showStdout(stderr);
        modal.pre.classList.add("error");
    }

    const commit = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        const cmd = modal.input.value;
        const option = modal.shellSelect.options[modal.shellSelect.selectedIndex];
        const shell = option.value;
        exec(cmd, shell, showStdout, showStdErr);
    }

    modal.commit.addEventListener("click", ev => commit(ev), true);

    modal.input.addEventListener("keydown", ev => {
        switch (ev.key) {
            case "Enter":
                commit(ev);
                break
            case "Escape":
                ev.stopPropagation();
                ev.preventDefault();
                modal.modal.style.display = "none";
                break
        }
    })

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            modal.modal.style.display = "block";
            modal.input.select();
            ev.preventDefault();
            ev.stopPropagation();
        }
    })

    if (config.USE_BUILTIN) {
        modal.builtinSelect.addEventListener("change", ev => {
            const option = modal.builtinSelect.options[modal.builtinSelect.selectedIndex];
            const cmd = option.value;
            const shell = option.getAttribute("shell");
            modal.input.value = cmd;
            modal.shellSelect.value = shell;
        })
    }

    if (config.ALLOW_DRAG) {
        modal.input.addEventListener("mousedown", ev => {
            ev.stopPropagation();
            const rect = modal.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    modal.modal.style.left = ev.clientX - shiftX + 'px';
                    modal.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    modal.modal.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        modal.input.ondragstart = () => false
    }

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
        global._exec = exec;
    }
    console.log("commander.js had been injected");
})()