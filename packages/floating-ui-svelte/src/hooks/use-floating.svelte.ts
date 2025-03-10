import {
	type ComputePositionConfig,
	type FloatingElement,
	type Middleware,
	type MiddlewareData,
	type Placement,
	type ReferenceElement,
	type Strategy,
	computePosition,
} from "@floating-ui/dom";
import { createPubSub } from "../internal/create-pub-sub.js";
import { getDPR, roundByDPR } from "../internal/dpr.js";
import { noop } from "../internal/noop.js";
import { styleObjectToString } from "../internal/style-object-to-string.js";
import type { OpenChangeReason } from "../types.js";
import { useId } from "./use-id.js";

interface FloatingElements {
	/**
	 * The reference element.
	 */
	reference?: ReferenceElement | null;

	/**
	 * The floating element.
	 */
	floating?: FloatingElement | null;
}

interface UseFloatingOptions {
	/**
	 * Represents the open/close state of the floating element.
	 * @default true
	 */
	open?: boolean;

	/**
	 * Callback that is called whenever the open state changes.
	 */
	onOpenChange?: (
		open: boolean,
		event?: Event,
		reason?: OpenChangeReason,
	) => void;

	/**
	 * Where to place the floating element relative to its reference element.
	 * @default 'bottom'
	 */
	placement?: Placement;

	/**
	 * The type of CSS position property to use.
	 * @default 'absolute'
	 */
	strategy?: Strategy;

	/**
	 * These are plain objects that modify the positioning coordinates in some fashion, or provide useful data for the consumer to use.
	 * @default []
	 */
	middleware?: Array<Middleware | undefined | null | false>;

	/**
	 * Whether to use `transform` instead of `top` and `left` styles to
	 * position the floating element (`floatingStyles`).
	 * @default true
	 */
	transform?: boolean;

	/**
	 * Object containing the floating and reference elements.
	 * @default {}
	 */
	elements?: FloatingElements;

	/**
	 * Callback to handle mounting/unmounting of the elements.
	 * @default undefined
	 */
	whileElementsMounted?: (
		reference: ReferenceElement,
		floating: FloatingElement,
		update: () => void,
	) => () => void;

	/**
	 * Unique node id when using `FloatingTree`.
	 * @default undefined
	 */
	nodeId?: string;
}

interface UseFloatingData {
	/**
	 * The x-coordinate of the floating element.
	 */
	x: number;

	/**
	 * The y-coordinate of the floating element.
	 */
	y: number;

	/**
	 * The stateful placement, which can be different from the initial `placement` passed as options.
	 */
	placement: Placement;

	/**
	 * The stateful strategy, which can be different from the initial `strategy` passed as options.
	 */
	strategy: Strategy;

	/**
	 * Additional data from middleware.
	 */
	middlewareData: MiddlewareData;

	/**
	 * The boolean that let you know if the floating element has been positioned.
	 */
	isPositioned: boolean;
}

interface FloatingEvents {
	// biome-ignore lint/suspicious/noExplicitAny: From the port
	emit<T extends string>(event: T, data?: any): void;
	// biome-ignore lint/suspicious/noExplicitAny: From the port
	on(event: string, handler: (data: any) => void): void;
	// biome-ignore lint/suspicious/noExplicitAny: From the port
	off(event: string, handler: (data: any) => void): void;
}

interface ContextData {
	/**
	 * The latest even that caused the open state to change.
	 */
	openEvent?: Event;

	/**
	 * Arbitrary data produced and consumed by other hooks.
	 */
	[key: string]: unknown;
}

interface FloatingContext extends UseFloatingData {
	/**
	 * Represents the open/close state of the floating element.
	 */
	open: boolean;

	/**
	 * Callback that is called whenever the open state changes.
	 */
	onOpenChange(open: boolean, event?: Event, reason?: OpenChangeReason): void;

	/**
	 * Events for other hooks to consume.
	 */
	events: FloatingEvents;

	/**
	 * Arbitrary data produced and consumer by other hooks.
	 */
	data: ContextData;

	/**
	 * The id for the reference element
	 */
	nodeId: string | undefined;

	/**
	 * The id for the floating element
	 */
	floatingId: string;

	/**
	 * Object containing the floating and reference elements.
	 */
	elements: FloatingElements;
}

interface UseFloatingReturn extends UseFloatingData {
	/**
	 * Represents the open/close state of the floating element.
	 */
	readonly open: boolean;

	/**
	 * CSS styles to apply to the floating element to position it.
	 */
	readonly floatingStyles: string;

	/**
	 * The reference and floating elements.
	 */
	readonly elements: FloatingElements;

	/**
	 * Updates the floating element position.
	 */
	readonly update: () => Promise<void>;

	/**
	 * Additional context meant for other hooks to consume.
	 */
	readonly context: FloatingContext;
}

/**
 * Hook for managing floating elements.
 */
function useFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
	const elements = $state(options.elements ?? {});
	const {
		placement = "bottom",
		strategy = "absolute",
		middleware = [],
		transform = true,
		open = true,
		onOpenChange: unstableOnOpenChange = noop,
		whileElementsMounted,
		nodeId,
	} = $derived(options);
	const floatingStyles = $derived.by(() => {
		const initialStyles = {
			position: strategy,
			left: "0px",
			top: "0px",
		};

		if (!elements.floating) {
			return styleObjectToString(initialStyles);
		}

		const x = roundByDPR(elements.floating, state.x);
		const y = roundByDPR(elements.floating, state.y);

		if (transform) {
			return styleObjectToString({
				...initialStyles,
				transform: `translate(${x}px, ${y}px)`,
				...(getDPR(elements.floating) >= 1.5 && { willChange: "transform" }),
			});
		}

		return styleObjectToString({
			position: strategy,
			left: `${x}px`,
			top: `${y}px`,
		});
	});

	const events = createPubSub();
	const data: ContextData = $state({});

	const onOpenChange = (
		open: boolean,
		event?: Event,
		reason?: OpenChangeReason,
	) => {
		data.openEvent = open ? event : undefined;
		events.emit("openchange", { open, event, reason });
		unstableOnOpenChange(open, event, reason);
	};

	const state: UseFloatingData = $state({
		x: 0,
		y: 0,
		strategy,
		placement,
		middlewareData: {},
		isPositioned: false,
	});

	const context: FloatingContext = $state({
		data,
		events,
		elements,
		onOpenChange,
		floatingId: useId(),
		get nodeId() {
			return nodeId;
		},
		get x() {
			return state.x;
		},
		get y() {
			return state.y;
		},
		get placement() {
			return state.placement;
		},
		get strategy() {
			return state.strategy;
		},
		get middlewareData() {
			return state.middlewareData;
		},
		get isPositioned() {
			return state.isPositioned;
		},
		get open() {
			return open;
		},
	});

	const update = async () => {
		if (!elements.floating || !elements.reference) {
			return;
		}

		const config: ComputePositionConfig = {
			placement,
			strategy,
			middleware,
		};

		const position = await computePosition(
			elements.reference,
			elements.floating,
			config,
		);

		state.x = position.x;
		state.y = position.y;
		state.placement = position.placement;
		state.strategy = position.strategy;
		state.middlewareData = position.middlewareData;
		state.isPositioned = true;
	};

	$effect.pre(() => {
		if (!options.elements || !options.elements.reference) {
			return;
		}
		elements.reference = options.elements.reference;
	});

	$effect.pre(() => {
		if (!options.elements || !options.elements.floating) {
			return;
		}
		elements.floating = options.elements.floating;
	});

	$effect.pre(() => {
		if (open || !state.isPositioned) {
			return;
		}

		state.isPositioned = false;
	});

	$effect.pre(() => {
		if (!elements.floating || !elements.reference) {
			return;
		}

		if (!whileElementsMounted) {
			update();
			return;
		}

		return whileElementsMounted(elements.reference, elements.floating, update);
	});

	return {
		update,
		context,
		elements,
		get x() {
			return state.x;
		},
		get y() {
			return state.y;
		},
		get placement() {
			return state.placement;
		},
		get strategy() {
			return state.strategy;
		},
		get middlewareData() {
			return state.middlewareData;
		},
		get isPositioned() {
			return state.isPositioned;
		},
		get open() {
			return open;
		},
		get floatingStyles() {
			return floatingStyles;
		},
	};
}

export type { UseFloatingOptions, UseFloatingReturn, FloatingContext };
export { useFloating };
