const treeify = require('treeify');
const colors = require('colors');

const {Expr, Atom} = require('./expression');


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

            for (let i = 2; dtree_node[goal_name] || dtree_node[goal_name] === false; ++i) {
                goal_name = `${goal}${i}`;
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
                    this._save_proof(rule.rhs.name);
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


module.exports = Prover;
