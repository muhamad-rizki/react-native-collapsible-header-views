import * as React from 'react'
import memoize from 'fast-memoize'
import {
  ScrollViewProps,
  View,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle
} from 'react-native'

const noop = () => { /**/ }

export type AnimationConfig = { animated?: boolean }

export type CollapsibleHeaderProps = {
  interpolatedHeaderTranslation: (from: number, to: number) => Animated.AnimatedInterpolation
  showHeader: (options: AnimationConfig | unknown) => void
  hideHeader: (options: AnimationConfig | unknown) => void
}

export type CollapsibleFooterProps = {
  interpolatedFooterTranslation: (from: number, to: number) => Animated.AnimatedInterpolation
  showFooter: (options: AnimationConfig | unknown) => void
  hideFooter: (options: AnimationConfig | unknown) => void
}


export type CollapsibleHeaderViewProps<T extends ScrollViewProps> = T & {
  // header props
  readonly CollapsibleHeaderComponent: React.ReactElement<unknown>
  | React.ComponentType<CollapsibleHeaderProps>
  readonly headerHeight: number
  readonly statusBarHeight: number
  readonly headerContainerBackgroundColor: string
  readonly disableHeaderSnap: boolean
  readonly stickyHeader: boolean
  readonly headerAnimationDuration: number

  // footer props
  readonly CollapsibleFooterComponent: React.ReactElement<unknown>
  | React.ComponentType<CollapsibleFooterProps>
  readonly footerHeight: number
  readonly footerContainerBackgroundColor: string
  readonly disableFooterSnap: boolean
  readonly stickyFooter: boolean
  readonly footerAnimationDuration: number
}

interface CollapsibleHeaderViewStyle {
  readonly fill: ViewStyle
  readonly header: ViewStyle
  readonly container: ViewStyle
  readonly footer: ViewStyle
}

export const withCollapsibleHeader = <T extends ScrollViewProps>(
  Component: React.ComponentClass<T>
) => {
  const AnimatedComponent =
    Animated.createAnimatedComponent(Component) as React.ComponentClass<ScrollViewProps>

  return class CollapsibleHeaderView extends React.Component<CollapsibleHeaderViewProps<T>> {

    static defaultProps = {
      statusBarHeight: 0,
      footerHeight: 0,
      headerHeight: 0,
      disableHeaderMomentum: false,
      headerMomentumDuration: 350,
      headerContainerBackgroundColor: 'white',
      footerMomentumDuration: 350,
      footerContainerBackgroundColor: 'white',
    }

    private scrollAnim = new Animated.Value(0)
    private offsetAnim = new Animated.Value(0)
    private clampedHeaderScroll?: Animated.AnimatedDiffClamp
    private clampedFooterScroll?: Animated.AnimatedDiffClamp
    private scrollValue = 0
    private offsetValue = 0
    private clampedHeaderScrollValue = 0
    private clampedFooterScrollValue = 0
    private scrollEndTimer = 0
    private headerSnap?: Animated.CompositeAnimation
    private footerSnap?: Animated.CompositeAnimation
    private headerTranslation?: Animated.AnimatedInterpolation
    private footerTranslation?: Animated.AnimatedInterpolation
    private currentHeaderHeight?: number
    private currentFooterHeight?: number
    private currentStatusBarHeight?: number
    private wrappedComponent: React.RefObject<any> = React.createRef()

    public constructor(props: CollapsibleHeaderViewProps<T>) {
      super(props)

      const { headerHeight, statusBarHeight, footerHeight } = props

      this.initAnimations(headerHeight, statusBarHeight, footerHeight)
    }

    private initAnimations(headerHeight: number, statusBarHeight: number, footerHeight: number) {
      this.scrollAnim.addListener(({ value }) => {
        const diff = value - this.scrollValue
        this.scrollValue = value
        this.clampedHeaderScrollValue = Math.min(
          Math.max(this.clampedHeaderScrollValue + diff, 0),
          headerHeight - statusBarHeight
        )
        this.clampedFooterScrollValue = Math.min(
          Math.max(this.clampedFooterScrollValue + diff, 0),
          footerHeight
        )
      })

      this.offsetAnim.addListener(({ value }) => {
        this.offsetValue = value
      })

      this.clampedHeaderScroll = Animated.diffClamp(
        Animated.add(
          this.scrollAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolateLeft: 'clamp'
          }),
          this.offsetAnim
        ),
        0,
        headerHeight - statusBarHeight
      )

      this.clampedFooterScroll = Animated.diffClamp(
        Animated.add(
          this.scrollAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolateLeft: 'clamp'
          }),
          this.offsetAnim
        ),
        0,
        footerHeight
      )

      this.headerTranslation = this.clampedHeaderScroll.interpolate({
        inputRange: [0, headerHeight - statusBarHeight],
        outputRange: [0, -(headerHeight - statusBarHeight)],
        extrapolate: 'clamp'
      })

      this.footerTranslation = this.clampedFooterScroll.interpolate({
        inputRange: [0, footerHeight],
        outputRange: [0, footerHeight],
        extrapolate: 'clamp'
      })

      this.currentHeaderHeight = headerHeight
      this.currentFooterHeight = footerHeight
      this.currentStatusBarHeight = statusBarHeight
    }

    private cleanupAnimations() {
      this.scrollAnim.removeAllListeners()
      this.offsetAnim.removeAllListeners()
      clearTimeout(this.scrollEndTimer)

      if (this.headerSnap) {
        this.headerSnap.stop()
      }
      if (this.footerSnap) {
        this.footerSnap.stop()
      }
    }

    private resetAnimations(headerHeight: number, statusBarHeight: number, footerHeight: number) {
      if (this.currentHeaderHeight !== headerHeight
        || this.currentStatusBarHeight !== statusBarHeight
        || this.currentFooterHeight !== footerHeight
      ) {
        this.cleanupAnimations()
        this.initAnimations(headerHeight, statusBarHeight, footerHeight)
      }
    }

    public componentWillUnmount() {
      this.cleanupAnimations()
    }

    public render() {
      const {
        statusBarHeight,
        CollapsibleHeaderComponent,
        CollapsibleFooterComponent,
        contentContainerStyle,
        headerHeight,
        onScroll,
        headerContainerBackgroundColor,
        footerContainerBackgroundColor,
        footerHeight,
        stickyFooter,
        stickyHeader,
        ...props
      } = this.props as CollapsibleHeaderViewProps<ScrollViewProps>

      this.resetAnimations(headerHeight, statusBarHeight, footerHeight)

      const headerProps = {
        interpolatedHeaderTranslation: this.interpolatedHeaderTranslation,
        showHeader: this.showHeader,
        hideHeader: this.hideHeader
      }

      const footerProps = {
        interpolatedFooterTranslation: this.interpolatedFooterTranslation,
        showFooter: this.showFooter,
        hideFooter: this.hideFooter
      }

      const Header = CollapsibleHeaderComponent as React.ComponentType<CollapsibleHeaderProps>

      const Footer = CollapsibleFooterComponent as React.ComponentType<CollapsibleFooterProps>

      const styles = style(headerHeight, statusBarHeight, headerContainerBackgroundColor, footerHeight, footerContainerBackgroundColor)

      return (
        <View style={styles.fill}>
          <AnimatedComponent
            bounces={false}
            overScrollMode={'never'}
            scrollEventThrottle={1}
            {...props}
            ref={this.wrappedComponent}
            contentContainerStyle={[contentContainerStyle, styles.container]}
            onMomentumScrollBegin={this.onMomentumScrollBegin}
            onMomentumScrollEnd={this.onMomentumScrollEnd}
            onScrollEndDrag={this.onScrollEndDrag}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: this.scrollAnim } } }],
              { useNativeDriver: true, listener: onScroll }
            )}
          />
          {
            !Header ? null
              : (
                <Animated.View
                  style={[styles.header, stickyHeader ? {} : [{ transform: [{ translateY: this.headerTranslation }] }]]}
                >
                  {React.isValidElement(Header) ? Header : <Header {...headerProps} />}
                </Animated.View>
              )
          }
          {
            !Footer ? null
              : (
                <Animated.View
                  style={[styles.footer, stickyFooter ? {} : [{ transform: [{ translateY: this.footerTranslation }] }]]}
                >
                  {React.isValidElement(Footer) ? Footer : <Footer {...footerProps} />}
                </Animated.View>
              )
          }
        </View>
      )
    }

    private onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { onScrollEndDrag = noop, disableHeaderSnap, disableFooterSnap } = this.props

      if (!disableHeaderSnap || !disableFooterSnap) {
        this.scrollEndTimer = setTimeout(this.onMomentumScrollEnd, 250)
      }

      onScrollEndDrag(event)
    }

    private onMomentumScrollBegin = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { onMomentumScrollBegin = noop, disableHeaderSnap, disableFooterSnap } = this.props

      if (!disableHeaderSnap || !disableFooterSnap) {
        clearTimeout(this.scrollEndTimer)
      }

      onMomentumScrollBegin(event)
    }

    private onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {
        statusBarHeight,
        onMomentumScrollEnd = noop,
        headerHeight,
        disableHeaderSnap,
        footerHeight,
        disableFooterSnap,
      } = this.props

      if (!disableHeaderSnap) {
        this.moveHeader(
          (this.scrollValue > headerHeight &&
            this.clampedHeaderScrollValue > (headerHeight - statusBarHeight) / 2)
            ? this.offsetValue + headerHeight
            : this.offsetValue - headerHeight
        )
      }

      if (!disableFooterSnap) {
        this.moveFooter(
          (this.scrollValue > footerHeight &&
            this.clampedFooterScrollValue > footerHeight / 2)
            ? this.offsetValue + footerHeight
            : this.offsetValue - footerHeight
        )
      }

      onMomentumScrollEnd(event)
    }

    private interpolatedHeaderTranslation = (from: number, to: number) => {
      const { headerHeight, statusBarHeight } = this.props

      return this.clampedHeaderScroll!.interpolate({
        inputRange: [0, headerHeight - statusBarHeight],
        outputRange: [from, to],
        extrapolate: 'clamp'
      })
    }

    private interpolatedFooterTranslation = (from: number, to: number) => {
      const { footerHeight } = this.props

      return this.clampedHeaderScroll!.interpolate({
        inputRange: [0, footerHeight],
        outputRange: [from, to],
        extrapolate: 'clamp'
      })
    }

    private static isAnimationConfig(options: AnimationConfig | unknown): boolean {
      return options && (options as AnimationConfig).animated !== undefined
    }

    public animatedComponent = () => {
      return this.wrappedComponent.current
    }

    public getNode = () => {
      return this.wrappedComponent.current.getNode()
    }

    public showHeader = (options: AnimationConfig | unknown) => {
      this.moveHeader(
        this.offsetValue - this.props.headerHeight,
        !CollapsibleHeaderView.isAnimationConfig(options) || (options as AnimationConfig).animated
      )
    }

    public showFooter = (options: AnimationConfig | unknown) => {
      this.moveFooter(
        this.offsetValue - this.props.footerHeight,
        !CollapsibleHeaderView.isAnimationConfig(options) || (options as AnimationConfig).animated
      )
    }

    public hideHeader = (options: AnimationConfig | unknown) => {
      const { headerHeight } = this.props

      this.moveHeader(
        this.offsetValue + (this.scrollValue > headerHeight ? headerHeight : this.scrollValue),
        !CollapsibleHeaderView.isAnimationConfig(options) || (options as AnimationConfig).animated
      )
    }

    public hideFooter = (options: AnimationConfig | unknown) => {
      const { footerHeight } = this.props

      this.moveFooter(
        this.offsetValue + (this.scrollValue > footerHeight ? footerHeight : this.scrollValue),
        !CollapsibleHeaderView.isAnimationConfig(options) || (options as AnimationConfig).animated
      )
    }

    private moveHeader(toValue: number, animated: boolean = true) {
      if (this.headerSnap) {
        this.headerSnap.stop()
      }

      if (animated) {
        this.headerSnap = Animated.timing(this.offsetAnim, {
          toValue,
          duration: this.props.headerAnimationDuration,
          useNativeDriver: true
        })

        this.headerSnap.start()

      } else {
        this.offsetAnim.setValue(toValue)
      }
    }

    private moveFooter(toValue: number, animated: boolean = true) {
      if (this.footerSnap) {
        this.footerSnap.stop()
      }

      if (animated) {
        this.footerSnap = Animated.timing(this.offsetAnim, {
          toValue,
          duration: this.props.footerAnimationDuration,
          useNativeDriver: true
        })

        this.footerSnap.start()

      } else {
        this.offsetAnim.setValue(toValue)
      }
    }
  }
}

const style = memoize(
  (headerHeight: number, statusBarHeight: number, headerBackgroundColor: string, footerHeight: number, footerBackgroundColor: string) =>
    StyleSheet.create<CollapsibleHeaderViewStyle>({
      fill: {
        flex: 1
      },
      header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: headerHeight,
        paddingTop: statusBarHeight,
        backgroundColor: headerBackgroundColor
      },
      footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: footerHeight,
        backgroundColor: footerBackgroundColor
      },
      container: {
        paddingTop: headerHeight,
        paddingBottom: footerHeight
      }
    })
)
