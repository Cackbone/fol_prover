const readline = require('readline');
const fs = require('fs');
const colors = require('colors');
const treeify = require('treeify');


class Expr {
    static from(str, consts, declaration=false, first=true) {
        if (!str) {
            throw new Error(`Invalid expression: ''`);
        }
        if (str.includes('=>')) {
            const parts = str.split('=>');

            if (parts.length !== 2) {
                throw new Error(`Invalid expression: ${str}`);
            }

            const lhs = Expr.from(parts[0], consts, false);
            const rhs = Expr.from(parts[1], consts, false);

            return new Implication(lhs, rhs);
        }
        const atoms = str
              .split('')
              .map(c => consts.get(c) || new Atom(c, false));
        let expr = null;

        for (let i = 0; i < atoms.length; ++i) {
            if (!expr) {
                expr = atoms[i];
            } else if (!declaration || !first){
                expr = new And(expr, atoms[i]);
            } else {
                throw new Error(`Invalid expression: ${str}`);
            }
        }

        return expr;
    }

    eval() {
        return false;
    }

    is_atom() {
        return false;
    }

    toString() {
        return '';
    }
}


class Operator extends Expr {
    constructor(lhs, rhs) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
    }
}


class And extends Operator {
    eval() {
        return this.lhs.eval() && this.rhs.eval();
    }

    toString() {
        return `${this.lhs.toString()}${this.rhs.toString()}`;
    }
}


class Implication extends Operator {
    eval() {
        return !this.lhs.eval() || this.rhs.eval();
    }

    toString() {
        return `${this.lhs.toString()}=>${this.rhs.toString()}`;
    }
}


class Atom extends Expr {
    constructor(name, value) {
        super();
        this.name = name;
        this.value = value;
    }

    eval() {
        return this.value;
    }

    is_atom() {
        return true;
    }

    toString() {
        return this.name;
    }
}


class KnowledgeBase {
    constructor(rules, consts) {
        this.rules = rules;
        this.consts = consts;
    }

    static from(str) {
        if (!str) {
            throw new Error(`Invalid knowledge base: ''`);
        }
        const lines = str.split(',');
        const raw_consts = lines.filter(l => l.length === 1);
        const raw_rules = lines.filter(l => l.length !== 1);
        const consts = new Map();
        const rules = [];

        for (const c of raw_consts) {
            consts.set(c, new Atom(c, true));
        }

        for (const r of raw_rules) {
            rules.push(Expr.from(r, consts, true));
        }

        return new KnowledgeBase(rules, consts);
    }

    /***
     * Get rules in KB that can lead to the goal
     */
    get_matching_rules(goal) {
        return this.rules.filter(r => (
            r.rhs.toString().includes(goal.toString())
        ));
    }

    toString() {
        const c_str = Array.from(this.consts.keys()).join(', ');
        const r_str = this.rules.map(r => r.toString()).join(',\n');

        return `${c_str},\n${r_str}`;
    }
}


class Prover {
    constructor(kb) {
        this.kb = kb;
        this.tmp_consts = new Map();
    }

    ask(raw_query, trace=false) {
        if (!this.kb) {
            throw new Error('Cannot evaluate your query, knowledge base is empty.');
        }
        const query = Expr.from(raw_query, this.kb.consts);
        // Used to display tree of backward chaining when trace is true
        const display_tree = {};
        display_tree[raw_query] = {};
        const result = this._expr_bc(query, display_tree[raw_query]);

        if (trace) {
            console.log(treeify.asTree(display_tree, true));
        }

        this.tmp_consts.clear();
        return result;
    }

    set_kb(kb) {
        this.kb = kb;
    }

    /**
     * Apply backward chaining to any Expr
     */
    _expr_bc(goal, dtree) {
        if (goal.is_atom()) {
            return this._backward_chaining(goal, dtree);
        }

        return this._bc_operator(goal, dtree);
    }

    _dtree_add(dtree_node, goal, success=true, proved=false) {
        if (proved) {
            let goal_name = goal;

            while (dtree_node[goal_name] || dtree_node[goal_name] === false) {
                goal_name += '\'';
            }
            const value = success ? colors.yellow('true') : colors.red('false');
            dtree_node[goal_name] = `${value} (already proved)`;
        } else if (success) {
            dtree_node[goal] = colors.green('true');
        } else {
            dtree_node[goal] = colors.red('false');
        }
    }

    _backward_chaining(goal, dtree) {
        // Goal satisfied by KB or already proved
        const goal_str = goal.toString();
        const proved = this.tmp_consts.get(goal_str);
        if (proved) {
            this._dtree_add(dtree, goal_str, proved.value, true);
            return true;
        } else if (goal.eval()) {
            this._dtree_add(dtree, goal_str);
            return true;
        }

        const rules = this.kb.get_matching_rules(goal);

        for (const rule of rules) {
            const str = rule.toString();
            dtree[str] = {};

            if (rule.lhs.eval()) {
                this._dtree_add(dtree, str);
                if (rule.rhs.is_atom()) {
                    this._save_proof(rule.rhs.name);
                }
                return true;
            }

            if (rule.lhs.is_atom()) {
                const res = this._backward_chaining(rule.lhs, dtree[str]);
                if (res) {
                    this._save_proof(rule.lhs.name);
                }
                return res;
            }

            if (this._bc_operator(rule.lhs, dtree[str])) {
                if (rule.rhs.is_atom()) {
                    this._save_proof(rule.rhs.name);
                }
                return true;
            }
        }

        this._dtree_add(dtree, goal_str, false);
        if (goal.is_atom()) {
            this._save_proof(goal.name, false);
        }

        return false;
    }


    _save_proof(name, success=true) {
        const proved = new Atom(name, success);
        this.tmp_consts.set(name, proved);
    }


    /**
     * Apply backward chaining to operators
     */
    _bc_operator(op, dtree) {
        const infered_lhs = op.lhs.is_atom()
              ? this._backward_chaining(op.lhs, dtree)
              : this._bc_operator(op.lhs, dtree);
        const infered_rhs = op.rhs.is_atom()
              ? this._backward_chaining(op.rhs, dtree)
              : this._bc_operator(op.rhs, dtree);
        const lhs = new Atom('_LHS', infered_lhs);
        const rhs = new Atom('_RHS', infered_rhs);
        const prev_lhs = op.lhs;
        const prev_rhs = op.rhs;
        op.lhs = lhs;
        op.rhs = rhs;
        const res = op.eval();
        op.lhs = prev_lhs;
        op.rhs = prev_rhs;

        return res;
    }
}


class REPL {
    constructor() {
        this.prover = new Prover();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.rl.on('line', this._handle_cmd.bind(this));
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
