const {Atom, Expr} = require('./expression');

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


module.exports = KnowledgeBase;
