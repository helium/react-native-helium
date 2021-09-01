require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-helium"
  s.authors      = { 'Matt Reetz' => 'matt@helium.com', 'Tyler Whitman' => 'tyler@helium.com' }
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]

  s.platforms    = { :ios => "10.0" }
  s.source       = { :git => "https://github.com/helium/react-native-helium.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"
end
