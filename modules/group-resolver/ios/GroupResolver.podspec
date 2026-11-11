Pod::Spec.new do |s|
  s.name           = 'GroupResolver'
  s.version        = '1.0.0'
  s.summary        = 'Resolve App Group and share data with the widget'
  s.description    = 'Local Expo module: resolves the usable App Group at runtime, writes shared payload, reloads widget timelines.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
