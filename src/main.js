const fs = require('fs');
const readline = require('readline');

const Prover = require('./prover');
const KnowledgeBase = require('./knowledgeBase');


class REPL {
    constructor() {
        this.prover = new Prover();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.rl
            .on('line', this._handle_cmd.bind(this))
            .on('close', () => process.exit(0));
        this.rl.prompt();
    }

    static run() {
        return (new REPL());
    }

    _handle_cmd(str) {
        const cmds = str.split(' ');

        switch (cmds[0]) {
        case 'loadkb':
            this._loadkb(cmds[1]);
            break;
        case 'ask':
            this._ask(cmds[1]);
            break;
        case 'trace':
            this._ask(cmds[1], true);
            break;
        case 'exit':
            this.rl.close();
            break;
        case '':
            break;
        default:
            console.error(`Unknown command: '${cmds[0]}'`);
        }

        this.rl.prompt();
    }

    _loadkb(filename) {
        try {
            const value = fs.readFileSync(filename, 'utf8').replace(/\s|\r?\n/g, '');
            const kb = KnowledgeBase.from(value);
            this.prover.set_kb(kb);
            console.log(kb.toString());
            console.log('Knowledge base loaded successfully');
        } catch (e) {
            console.error(e.message);
        }
    }

    _ask(query, trace=false) {
        try {
            console.log(this.prover.ask(query, trace));
        } catch (e) {
            console.error(e.message);
        }
    }
}


REPL.run();
