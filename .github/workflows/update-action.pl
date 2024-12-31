#!/usr/bin/env perl
exit(0) unless -d 'node-action';
my $action_file = 'action.yml';
my $action_temp = 'action.yml.new';
open my $action_in, '<', $action_file;
open my $action_out, '>', $action_temp;
my $state;
my $repository = $ENV{GITHUB_REPOSITORY};
my $version = $ENV{version};
while (<$action_in>) {
  if ($state == 0) {
    $state = 1 if /^runs:/;
  } elsif ($state == 1) {
    $state = 2 if /^\s+using:\s+composite/;
  } elsif ($state == 2) {
    if (m{uses:\s+sbt/setup-sbt}) {
      # definitely not the right step
    } elsif (m<uses: $repository>) {
      s<$repository(?:/node-action|)\@\S+><$repository/node-action\@$version>;
      $state = 3;
    }
  }
  print $action_out $_;
}
close $action_in;
close $action_out;
rename $action_temp, $action_file;
