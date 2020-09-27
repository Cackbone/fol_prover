// expression.js

class Expr {
    static from(str, consts, declaration=false, first=true) {
        if (!str) {
            throw new Error(`Invalid expression: ''`);
        }

        if (str.includes('=>')) {
            return Implication.from(str, consts);
        }

        const atoms = str
              .split('')
              .map(c => consts.get(c) || Atom.from(c, false));
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
    static from(str, consts) {
        const parts = str.split('=>');

        if (parts.length !== 2) {
            throw new Error(`Invalid expression: '${str}'`);
        }

        const lhs = Expr.from(parts[0], consts, false);
        const rhs = Expr.from(parts[1], consts, false);

        return new Implication(lhs, rhs);
    }

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

    static from(name, value) {
        if (name.length !== 1 || !name.match(/[A-Z]/)) {
            throw new Error(`Invalid symbol: '${name}'`);
        }

        return new Atom(name, value);
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


module.exports = {Atom, Expr, And, Implication};
