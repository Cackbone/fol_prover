const readline = require('readline');
const fs = require('fs');
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
        const atoms = str.split('').map(c => consts.get(c) || new Atom(c, false));
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

    get_matching_rules(q) {
        return this.rules.filter(r => r.rhs.toString().includes(q.toString()));
    }

    toString() {
        return `${Array.from(this.consts.keys()).join(', ')},\n${this.rules.map(r => r.toString()).join(',\n')}`;
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
        let display_tree = {};
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

    _expr_bc(goal, dtree) {
        if (goal.is_atom()) {
            return this._backward_chaining(goal, dtree);
        }

        return this._bc_operator(goal, dtree);
    }

    _backward_chaining(goal, dtree) {
        // Goal satisfied by KB
        if (this.tmp_consts.get(goal.toString())) {
            dtree[goal.toString()] = 'true (already proved)';
            return true;
        } else if (goal.eval()) {
            dtree[goal.toString()] = true;
            return true;
        }

        const rules = this.kb.get_matching_rules(goal);

        for (const rule of rules) {
            const str = rule.toString();
            dtree[str] = {};

            if (rule.lhs.eval()) {
                dtree[str] = true;
                if (rule.rhs.is_atom()) {
                    const proved = new Atom(rule.lhs.name, true);
                    this.tmp_consts.set(rule.rhs.name, proved);
                }
                return true;
            }

            if (rule.lhs.is_atom()) {
                const res = this._backward_chaining(rule.lhs, dtree[str]);
                if (res) {
                    const proved = new Atom(rule.lhs.name, true);
                    this.tmp_consts.set(rule.lhs.name, proved);
                }
                return res;
            }

            if (this._bc_operator(rule.lhs, dtree[str])) {
                return true;
            }
        }

        dtree[goal.toString()] = false;

        return false;
    }

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


function cli(value, rl, prover) {
    const cmds = value.split(' ');

    if (cmds[0] === 'loadkb') {
        try {
            const value = fs.readFileSync(cmds[1], 'utf8').replace(/\s|\r?\n/g, '');
            const kb = KnowledgeBase.from(value);
            prover.set_kb(kb);
            console.log(kb.toString());
            console.log('Knowledge base loaded successfully');
        } catch (e) {
            console.error(e.message);
        }
    } else if (cmds[0] === 'ask') {
        try {
            console.log(prover.ask(cmds[1]));
        } catch (e) {
            console.error(e.message);
        }
    } else if (cmds[0] === 'trace') {
        try {
            console.log(prover.ask(cmds[1], true));
        } catch (e) {
            console.error(e.message);
        }
    } else if (cmds[0] === 'exit') {
        rl.close();
    }

    rl.prompt();
}


function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const prover = new Prover();

    rl.prompt();
    rl.on('line', (val) => cli(val, rl, prover));
}


main();
