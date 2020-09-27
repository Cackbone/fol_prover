# Logic prover

## How to use

Install dependencies with npm
```
npm i
```

Run the REPL
```
npm start
```

You can load a knowledge base from a file with
```
> loadkb <filename>
```

The knowledge base must be in the horn clause form, for example:
```
A, B,
AB => L,
AP => L,
BL => M,
LM => P,
P => Q
```

When the knowledge base is loaded you can use ask and trace to prove a query in horn clause form. For example:

```
> ask Q
true
```

```
> trace Q
└─ Q
   └─ P=>Q
      └─ LM=>P
         ├─ AB=>L: true
         └─ BL=>M
            ├─ B: true
            └─ L: true (already proved)

true
```

Type help to get the list of commands:
```
> help
Available commands:
* loadkb <filename>: Load a knowledge base in horn clause form
* ask <query>: Ask for a proof in horn clause form
* trace <query>: Same as 'ask' with a tree of the execution
* help: Display a list of commands
* exit
```
