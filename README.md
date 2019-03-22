# gnome-shell-extension-es6-class-codemod

A [jscodeshift](https://github.com/facebook/jscodeshift/) transform that helps [migrating GNOME Shell extensions to 3.32](https://gitlab.gnome.org/GNOME/gnome-shell/merge_requests/361).

## What it does

In order to migrate to the new ES6 class based syntax in GNOME Shell 3.32, the following changes will be made by this transform:

- Replace `new Lang.Class()` and `new GObject.Class()` with the ES6 `class` syntax.
    - If the old class is a GObject class, wrap the new class with `GObject.registerClass()`.
- Replace `_init()` with `constructor`, if the old class is not a GObject class.
- Replace `this.parent()` with `super.methodName()`, or `super()` if it's instead the `constructor`.
- Add import for `GObject` if any old class was a GObject class, and remove import for `Lang` if it become unused.

The transform tries its best to preserve comments and spacing. However in some cases, you might still need to adjust the spacing manually, which is a limitation of the underlying framework.

## Usage

```bash
npm install
# This will modify the files in place.
npx jscodeshift --run-in-band path/to/your/extension
```

To see a example, run `npm test`.
