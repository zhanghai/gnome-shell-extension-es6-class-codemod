import promptCreate from 'prompt-sync';

const prompt = promptCreate();

function yesNo(message) {
    while (true) {
        let response = prompt(`${message} (y/n): `);
        response = response.trim().toLowerCase();
        switch (response) {
            case 'y':
            case 'yes':
                return true;
            case 'n':
            case 'no':
                return false;
            default:
                console.error('Invalid response: ' + response);
        }
    }
}

export default function transformer(file, api) {

    const jscs = api.jscodeshift;
    const collection = jscs(file.source);

    let hasClass = false;
    let hasGObjectClass = false;

    collection
            .find(jscs.NewExpression, {
                callee: {
                    type: 'MemberExpression',
                    object: {
                        type: 'Identifier',
                        name: name => name === 'Lang' || name === 'GObject'
                    },
                    property: {
                        type: 'Identifier',
                        name: 'Class'
                    }
                },
                arguments: [
                    {
                        type: 'ObjectExpression',
                        properties: []
                    }
                ]
            })
            .replaceWith(path => {
                hasClass = true;

                const newExpression = path.node;
                if (newExpression.arguments.length !== 1) {
                    throw new Error(`newExpression.arguments.length: ${newExpression.arguments.length}`);
                }
                const objectExpression = newExpression.arguments[0];

                let id = null;
                let superClass = null;
                for (const property of objectExpression.properties) {
                    if (property.key.type !== 'Identifier') {
                        throw new Error(`property.key.type: ${property.key.type}`);
                    }
                    switch (property.key.name) {
                        case 'Name': {
                            if (property.value.type !== 'Literal') {
                                throw new Error(`property.value.type: ${property.value.type}`);
                            }
                            const name = property.value.value.replace(/\./g, '_');
                            id = jscs.identifier(name);
                            break;
                        }
                        case 'GTypeName':
                            console.warn(`Ignoring GTypeName: ${jscs(property.value).toSource()}`);
                            break;
                        case 'Extends':
                            superClass = property.value;
                            break;
                    }
                }

                let isGObjectClass = null;
                if (newExpression.callee.object.name === 'GObject') {
                    isGObjectClass = true;
                } else if (superClass === null) {
                    isGObjectClass = false;
                } else {
                    if (superClass.type === 'MemberExpression' && superClass.object.type === 'Identifier') {
                        const isSuperClassFromGi = collection
                                .find(jscs.VariableDeclarator, {
                                    id: {
                                        name: superClass.object.name
                                    },
                                    init: {
                                        type: 'MemberExpression',
                                        object: {
                                            type: 'MemberExpression',
                                            object: {
                                                type: 'Identifier',
                                                name: 'imports'
                                            },
                                            property: {
                                                type: 'Identifier',
                                                name: 'gi'
                                            }
                                        }
                                    }
                                })
                                .length > 0;
                        if (isSuperClassFromGi) {
                            isGObjectClass = true;
                        }
                    }
                    if (isGObjectClass === null) {
                        isGObjectClass = yesNo(`Is ${jscs(superClass).toSource()} a GObject class?`);
                    }
                }
                if (isGObjectClass) {
                    hasGObjectClass = true;
                }

                const body = [];
                for (const property of objectExpression.properties) {
                    switch (property.key.name) {
                        case 'Name':
                        case 'GTypeName':
                        case 'Extends':
                            break;
                        default: {
                            if (property.value.type !== 'FunctionExpression') {
                                throw new Error(`property.value.type: ${property.value.type}`);
                            }
                            const kind = property.kind !== 'init' ? property.kind : 'method';
                            let key;
                            let isConstructor;
                            switch (property.key.name) {
                                case '_init':
                                    if (!isGObjectClass) {
                                        key = jscs.identifier('constructor');
                                        isConstructor = true;
                                        break;
                                    }
                                    // Fall through!
                                default:
                                    key = property.key;
                                    isConstructor = false;
                            }
                            jscs(property.value)
                                    .find(jscs.MemberExpression, {
                                        object: {
                                            type: 'ThisExpression'
                                        },
                                        property: {
                                            type: 'Identifier',
                                            name: 'parent'
                                        }
                                    })
                                    .replaceWith(path => {
                                        if (isConstructor) {
                                            return jscs.super();
                                        } else {
                                            return jscs.memberExpression(jscs.super(), key);
                                        }
                                    });
                            const methodDefinition = jscs.methodDefinition(kind, key, property.value);
                            methodDefinition.comments = property.comments;
                            body.push(methodDefinition);
                        }
                    }
                }
                const classBody = jscs.classBody(body);

                const classExpression = jscs.classExpression(id, classBody, superClass);
                if (isGObjectClass) {
                    return jscs.callExpression(
                            jscs.memberExpression(jscs.identifier('GObject'), jscs.identifier('registerClass')),
                            [classExpression]);
                } else {
                    return classExpression;
                }
            });

    if (hasGObjectClass) {
        const gObjectImportFound = collection
                .find(jscs.Identifier, {
                    name: 'GObject'
                })
                .some(path => path.parent.node.type === 'VariableDeclarator');
        if (!gObjectImportFound) {
            const variableDeclaration = jscs.variableDeclaration('const', [jscs.variableDeclarator(
                    jscs.identifier('GObject'),
                    jscs.memberExpression(
                            jscs.memberExpression(jscs.identifier('imports'), jscs.identifier('gi')),
                            jscs.identifier('GObject')))]);
            const bodyPath = collection.get().get('program', 'body');
            const firstNode = bodyPath.get(0).node;
            variableDeclaration.comments = firstNode.comments;
            firstNode.comments = null;
            bodyPath.unshift(variableDeclaration);
        }
    }

    if (hasClass) {
        const langUsageFound = collection
                .find(jscs.Identifier, {
                    name: 'Lang'
                })
                .some(path => path.parent.node.type !== 'VariableDeclarator');
        if (!langUsageFound) {
            const path = collection
                    .find(jscs.VariableDeclaration, {
                        declarations: [
                            {
                                type: 'VariableDeclarator',
                                id: {
                                    name: 'Lang'
                                }
                            }
                        ]
                    })
                    .get();
            if (path) {
                const comments = path.node.comments;
                const parentPath = path.parentPath;
                const nextPathName = path.name;
                path.prune();
                if (nextPathName < parentPath.value.length) {
                    const nextNode = parentPath.get(nextPathName).node;
                    if (nextNode.comments) {
                        nextNode.comments.unshift(...comments);
                    } else {
                        nextNode.comments = comments;
                    }
                }
            }
        }
    }

    return collection.toSource();
};
