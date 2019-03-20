# gnome-shell-es6-class-codemod

A [jscodeshift](https://github.com/facebook/jscodeshift/) transform that helps [migrating GNOME Shell extensions to 3.32](https://gitlab.gnome.org/GNOME/gnome-shell/merge_requests/361).

It basically tries to replace usage of `Lang.Class()` and `GObject.Class()` to the ES6 `class` syntax, and optionally wrapped by `GObject.registerClass()`. It also replaces `this.parent()` calls to `super.<methodName>`, and `_init()` to `constructor`, taking whether the class is a GObject class into consideration.

The transform tries its best to preserve comments and spacing. However in some cases, you might still need to adjust the spacing manually. This is a limitation of the underlying framework, and the transform itself can do little about it.

## Usage

```bash
npm install
# This will modify the files in place.
npx jscodeshift --run-in-band path/to/your/extension
```

To see a example, run `npm test`.
