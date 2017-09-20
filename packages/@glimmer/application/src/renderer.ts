import {
  ElementBuilder,
  RenderResult,
  TemplateIterator,
  RenderLayoutOptions
} from "@glimmer/runtime";
import { Simple, Option } from "@glimmer/interfaces";
import Environment from './environment';
import { UpdatableReference } from "@glimmer/object-reference";
import DynamicScope from './dynamic-scope';

export type Cursor = { element: Simple.Element, nextSibling: Option<Simple.Node> };

export class AbstractRenderer {
  static create(env: Environment) {
    return new this(env);
  }

  constructor(protected env: Environment) {}
}

export default abstract class Renderer extends AbstractRenderer {
  private renderResult: RenderResult;

  abstract layoutBuilder(cursor: Cursor): ElementBuilder;
  abstract mainLayout(options: RenderLayoutOptions): TemplateIterator;

  private layoutOptions(context: Object, cursor: Cursor) {
    let builder = this.layoutBuilder(cursor);
    let self = new UpdatableReference(context);
    let dynamicScope = new DynamicScope();
    return { builder, self, dynamicScope, env: this.env };
  }

  /** @hidden
   *
   * Ensures the DOM is up-to-date by performing a revalidation on the root
   * template's render result. This method should not be called directly;
   * instead, any mutations in the program that could cause side-effects should
   * call `scheduleRerender()`, which ensures that DOM updates only happen once
   * at the end of the browser's event loop.
   */
  rerender(context?: Object) {
    let { env, renderResult } = this;

    if (!renderResult) {
      throw new Error('Cannot re-render before initial render has completed');
    }

    env.begin();
    renderResult.rerender();
    env.commit();
  }

  /** @hidden */
  render(context: Object, cursor: Cursor): void {
    let { env } = this;
    let options = this.layoutOptions(context, cursor);
    let templateIterator = this.mainLayout(options);
    // Begin a new transaction. The transaction stores things like component
    // lifecycle events so they can be flushed once rendering has completed.
    env.begin();

    // Iterate the template iterator, executing the compiled template program
    // until there are no more instructions left to execute.
    let result;
    do {
      result = templateIterator.next();
    } while (!result.done);

    // Finally, commit the transaction and flush component lifecycle hooks.
    env.commit();

    this.renderResult = result.value;
  }
}